// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LandRegistry
 * @notice Academic prototype smart contract for tamper-resistant land registration,
 *         document hash verification, and multi-party ownership transfers.
 */
contract LandRegistry {
    struct Land {
        uint256 propertyId;
        address currentOwner;
        string location;
        string village;
        string district;
        string state;
        string surveyNumber;
        uint256 area;
        bytes32 documentHash;
        uint256 registeredAt;
        bool exists;
    }

    struct TransferRequest {
        uint256 propertyId;
        address currentOwner;
        address proposedOwner;
        uint256 requestTimestamp;
        bool recipientAccepted;
        bool completed;
        bool rejected;
        bool cancelled;
        bool active;
    }

    address public immutable admin;

    uint256[] private _allPropertyIds;
    mapping(uint256 => Land) private _lands;
    mapping(uint256 => TransferRequest) private _pendingTransfers;
    mapping(address => uint256[]) private _ownerProperties;
    mapping(uint256 => address[]) private _ownershipHistory;
    mapping(bytes32 => uint256) private _surveyHashToPropertyId;

    event LandRegistered(
        uint256 indexed propertyId,
        address indexed owner,
        string surveyNumber,
        bytes32 documentHash,
        uint256 timestamp
    );

    event TransferRequested(
        uint256 indexed propertyId,
        address indexed currentOwner,
        address indexed proposedOwner,
        uint256 timestamp
    );

    event TransferAccepted(
        uint256 indexed propertyId,
        address indexed proposedOwner,
        uint256 timestamp
    );

    event OwnershipTransferred(
        uint256 indexed propertyId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    event TransferRejected(
        uint256 indexed propertyId,
        address indexed proposedOwner,
        address indexed rejectedBy,
        uint256 timestamp
    );

    event TransferCancelled(
        uint256 indexed propertyId,
        address indexed cancelledBy,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only registry admin is authorized");
        _;
    }

    modifier landExists(uint256 _propertyId) {
        require(_lands[_propertyId].exists, "Property does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerLand(
        uint256 _propertyId,
        address _owner,
        string calldata _location,
        string calldata _village,
        string calldata _district,
        string calldata _state,
        string calldata _surveyNumber,
        uint256 _area,
        bytes32 _documentHash
    ) external onlyAdmin {
        require(_propertyId > 0, "Property ID must be greater than zero");
        require(!_lands[_propertyId].exists, "Property ID already registered");
        require(_owner != address(0), "Invalid owner wallet address");
        require(bytes(_location).length > 0, "Location is required");
        require(bytes(_district).length > 0, "District is required");
        require(bytes(_state).length > 0, "State is required");
        require(bytes(_surveyNumber).length > 0, "Survey number is required");
        require(_area > 0, "Land area must be greater than zero");
        require(_documentHash != bytes32(0), "Valid document SHA-256 hash is required");

        bytes32 surveyKey = keccak256(bytes(_surveyNumber));
        require(_surveyHashToPropertyId[surveyKey] == 0, "Survey number already registered");

        uint256 timestamp = block.timestamp;

        _lands[_propertyId] = Land({
            propertyId: _propertyId,
            currentOwner: _owner,
            location: _location,
            village: _village,
            district: _district,
            state: _state,
            surveyNumber: _surveyNumber,
            area: _area,
            documentHash: _documentHash,
            registeredAt: timestamp,
            exists: true
        });

        _allPropertyIds.push(_propertyId);
        _ownerProperties[_owner].push(_propertyId);
        _ownershipHistory[_propertyId].push(_owner);
        _surveyHashToPropertyId[surveyKey] = _propertyId;

        emit LandRegistered(_propertyId, _owner, _surveyNumber, _documentHash, timestamp);
    }

    function requestTransfer(uint256 _propertyId, address _proposedOwner)
        external
        landExists(_propertyId)
    {
        Land storage land = _lands[_propertyId];
        require(msg.sender == land.currentOwner, "Only current owner can initiate transfer");
        require(_proposedOwner != address(0), "Invalid recipient wallet address");
        require(_proposedOwner != land.currentOwner, "Cannot transfer property to current owner");
        require(!_pendingTransfers[_propertyId].active, "Pending transfer already exists");

        uint256 timestamp = block.timestamp;

        _pendingTransfers[_propertyId] = TransferRequest({
            propertyId: _propertyId,
            currentOwner: land.currentOwner,
            proposedOwner: _proposedOwner,
            requestTimestamp: timestamp,
            recipientAccepted: false,
            completed: false,
            rejected: false,
            cancelled: false,
            active: true
        });

        emit TransferRequested(_propertyId, land.currentOwner, _proposedOwner, timestamp);
    }

    function acceptTransfer(uint256 _propertyId) external landExists(_propertyId) {
        TransferRequest storage req = _pendingTransfers[_propertyId];
        require(req.active, "No active transfer request");
        require(msg.sender == req.proposedOwner, "Only proposed recipient can accept transfer");
        require(!req.recipientAccepted, "Transfer already accepted by recipient");

        req.recipientAccepted = true;

        emit TransferAccepted(_propertyId, msg.sender, block.timestamp);
    }

    function approveTransfer(uint256 _propertyId)
        external
        onlyAdmin
        landExists(_propertyId)
    {
        TransferRequest storage req = _pendingTransfers[_propertyId];
        require(req.active, "No active transfer request");
        require(req.recipientAccepted, "Recipient has not accepted the transfer yet");

        Land storage land = _lands[_propertyId];
        address previousOwner = land.currentOwner;
        address newOwner = req.proposedOwner;

        _removePropertyFromOwner(previousOwner, _propertyId);
        _ownerProperties[newOwner].push(_propertyId);
        land.currentOwner = newOwner;
        _ownershipHistory[_propertyId].push(newOwner);

        req.completed = true;
        req.active = false;

        emit OwnershipTransferred(_propertyId, previousOwner, newOwner, block.timestamp);
    }

    function rejectTransfer(uint256 _propertyId)
        external
        onlyAdmin
        landExists(_propertyId)
    {
        TransferRequest storage req = _pendingTransfers[_propertyId];
        require(req.active, "No active transfer request");

        req.rejected = true;
        req.active = false;

        emit TransferRejected(_propertyId, req.proposedOwner, msg.sender, block.timestamp);
    }

    function cancelTransfer(uint256 _propertyId) external landExists(_propertyId) {
        TransferRequest storage req = _pendingTransfers[_propertyId];
        require(req.active, "No active transfer request");
        require(
            msg.sender == _lands[_propertyId].currentOwner,
            "Only current owner can cancel transfer"
        );

        req.cancelled = true;
        req.active = false;

        emit TransferCancelled(_propertyId, msg.sender, block.timestamp);
    }

    function verifyLand(uint256 _propertyId, bytes32 _documentHash)
        external
        view
        returns (
            bool exists,
            bool documentMatches,
            address currentOwner,
            uint256 registeredAt
        )
    {
        Land storage land = _lands[_propertyId];
        if (!land.exists) {
            return (false, false, address(0), 0);
        }
        return (
            true,
            land.documentHash == _documentHash,
            land.currentOwner,
            land.registeredAt
        );
    }

    function getLandDetails(uint256 _propertyId)
        external
        view
        landExists(_propertyId)
        returns (Land memory)
    {
        return _lands[_propertyId];
    }

    function getPendingTransfer(uint256 _propertyId)
        external
        view
        returns (TransferRequest memory)
    {
        return _pendingTransfers[_propertyId];
    }

    function getLandCount() external view returns (uint256) {
        return _allPropertyIds.length;
    }

    function getAllPropertyIds() external view returns (uint256[] memory) {
        return _allPropertyIds;
    }

    function getOwnerProperties(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        return _ownerProperties[_owner];
    }

    function getOwnershipHistory(uint256 _propertyId)
        external
        view
        landExists(_propertyId)
        returns (address[] memory)
    {
        return _ownershipHistory[_propertyId];
    }

    function getPropertyIdBySurveyNumber(string calldata _surveyNumber)
        external
        view
        returns (uint256)
    {
        return _surveyHashToPropertyId[keccak256(bytes(_surveyNumber))];
    }

    function _removePropertyFromOwner(address _owner, uint256 _propertyId) private {
        uint256[] storage list = _ownerProperties[_owner];
        uint256 len = list.length;
        for (uint256 i = 0; i < len; i++) {
            if (list[i] == _propertyId) {
                list[i] = list[len - 1];
                list.pop();
                break;
            }
        }
    }
}
