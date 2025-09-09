sap.ui.define([
	"com/bosch/rbf0/lo/rfidlc/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/ws/SapPcpWebSocket",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"sap/m/InstanceManager",
	"sap/m/MessageToast",
	"com/bosch/rbf0/lo/rfidlc/model/formatter",
	"sap/m/library",
	"sap/ui/core/library"
], function (Controller, JSONModel, SapPcpWebSocket, Filter, FilterOperator, MessageBox,
	 InstanceManager, MessageToast, formatter,mobileLibrary,coreLibrary) {
	"use strict";
	
	// shortcut for sap.m.DialogType
	var DialogType = mobileLibrary.DialogType;

	// shortcut for sap.ui.core.ValueState
	var ValueState = coreLibrary.ValueState;

	return Controller.extend("com.bosch.rbf0.lo.rfidlc.controller.Monitor", {

		formatter: formatter,

		/* ==============================================================================================================================
		 * Attributes
		 * ============================================================================================================================== */
		//_oStore: jQuery.sap.storage(jQuery.sap.storage.Type.local),

		_sGate: null,
		_sLoadNumber: null,
		_iCountLeft: 0,
		_iCountTotal: 0,
		_isRefresh: 1,

		_oWebSocket: null,
		_sCloseReason: "NAVBACK",
		_iCloseCode: 1000,

		_oLeftTable: null,
		_oMiddleTable: null,
		_oRightTable: null,

		_oViewModel: null,

		_sError: "#fbdfdf",
		_sWarning: "#fef0db",
		_sSuccess: "#e0f1e7",

		_oDialog: null,
		_oDialogMessage: null,
		 
		/* ==============================================================================================================================
		 * Lifecycle methods
		 * ============================================================================================================================== */

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onInit: function () {
			this.myTimeoutId = null;
			// Save the tables as variables
			this._oLeftTable = this.byId("idStatusTable");
			this._oMiddleTable = this.byId("idMiddle");
			this._oRightTable = this.byId("idErrorTable");
			this._oDummyLeftTable = this.byId("oDummyLeftTable");
			this._oDummyMiddleTable = this.byId("oDummyMiddleTable");
			this._oDummyRightTable = this.byId("oDummyRightTable");
			// Hook up the router
			this.getRouter().getRoute("monitor").attachPatternMatched(this._onMonitorMatched, this);
		},

		/**
		 * Called when the route of this view is matched
		 * Initiates the connection to the ABAP Push
		 * @param {sap.ui.base.Event} oEvent 
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_onMonitorMatched: function (oEvent) {
			var oViewModel = new JSONModel({
				WarehouseNo: "",
				Gate: "",
				CountCurrent: 0,
				CountTotal: 0,
				LeftTableCount: 0,
				CenterTableCount: 0,
				errorFound: false,
				ErrorTableCount: 0,
				cancelLabel: sap.ui.getCore().getLibraryResourceBundle("sap.m").getText("MESSAGEPOPOVER_CLOSE"),
				bLockMonitor: false,
				sPhoto: null,
				iPicHeight: "100px",
				PGI: {
					percentage: 0,
					displayText: ""
				},
				DialogType: "",
				ValueState: ValueState.Information,
				E_MessageInfor: "",
				SPECIFICTIMEMSG: 0,
				Count_Open_Diag: 0
			});
			var oHeaderLineModel =  new JSONModel({
				oHeaderLineSet:{}
			  });
			this.setModel(oViewModel, "monitorView");
			this._oViewModel = oViewModel;
			this.setModel(oHeaderLineModel, "oHeaderLineModel");
			this._resetView();
			this._createBackgroundColor();
			var oArgs = oEvent.getParameter("arguments");
			this.getOwnerComponent().getModel().metadataLoaded()
				.then(function () {
					if (oArgs.hasOwnProperty("WarehouseNo") &&
						oArgs.hasOwnProperty("gate")) {
						this._oViewModel.setProperty("/WarehouseNo", oArgs.WarehouseNo);
						this._oViewModel.setProperty("/Gate", oArgs.gate);
						window.setTimeout(function () {
							this.initAbapChannel();
							this.getLocalStorage();
							//for testing purpose.
							//this.onShowTestMessage();
							 //End of testing
						}.bind(this), 100);					
					} else {
						this.onNavButtonPress();
					}
				}.bind(this));
		},
		onShowTestMessage : function(){
			let sMessage = this.getResourceBundle().getText("msgHuLoadedSuccess");
			this._showDialogMessage(sMessage,DialogType.Message,ValueState.Success,5000);
		},
		/* ==============================================================================================================================
		 * Page Header
		 * ============================================================================================================================== */

		/**
		 * Called when user presses back button
		 * Closes WebSocket and navigates to start page
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onNavButtonPress: function () {
			this._isRefresh = 0;
			if (this._oWebSocket !== null) {
				this._oWebSocket.close(this._iCloseCode, this._sCloseReason);
				this._oWebSocket = null;
			}
			Controller.prototype.onNavBack.call(this);
		},

		/* ==============================================================================================================================
		 * Header
		 * ============================================================================================================================== */

		/**
		 * Bind the header to an element in the model and loads header data
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_bindHeader: function () {
			var that = this;
			var sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				sHeaderInfoKey = this.getModel().createKey("/HeaderLineSet", {
					WarehouseNo: sWarehouseNo,
					Gate: sGate
				});
			var aFilters = [];
			let aFilter = {};
			aFilter = new sap.ui.model.Filter({
				path: "WarehouseNo",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sWarehouseNo
			});	 
			aFilters.push(aFilter);
			aFilter = new sap.ui.model.Filter({
				path: "Gate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sGate
			});	 
			aFilters.push(aFilter);
			this.setBusy(true);
			this.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  []);
			this.getHeaderLineSet(aFilters,sHeaderInfoKey).then(
				function (aData) {
					//debugger;
					that.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  aData);
					this.setBusy(false);
				}.bind(this),
				function (oError) { this.setBusy(false); }.bind(this)
			);
		},
		_bindHeaderPreviousSession: function () {
			//this.getView().getModel().refresh();
			var that = this;
			var sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				sHeaderInfoKey = this.getModel().createKey("/HeaderLineSet", {
					WarehouseNo: sWarehouseNo,
					Gate: sGate
				});
			var aFilters = [];
			let aFilter = {};
			aFilter = new sap.ui.model.Filter({
				path: "WarehouseNo",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sWarehouseNo
			});	 
			aFilters.push(aFilter);
			aFilter = new sap.ui.model.Filter({
				path: "Gate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sGate
			});	 
			aFilters.push(aFilter);
			this.setBusy(true);
			this.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  []);
			this.getHeaderLineSet(aFilters,sHeaderInfoKey).then(
				function (aData) {
					//debugger;
					that.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  aData);
					this.setBusy(false);
				}.bind(this),
				function (oError) { this.setBusy(false); }.bind(this)
			);
		},
		getHeaderLineSet :function(aFilter,sHeaderInfoKey)
		{
			return new Promise((resolve, reject) => {
				let oModel = this.getView().getModel();
				oModel.read(sHeaderInfoKey, {
					filters: aFilter,
					urlParameters: {},
					success: function (oData) {
						resolve(oData);
						//debugger;
					},
					error: function (oError) {
						reject(oError);
						//debugger;
					}
				});
			});
		},
		/**
		 * Unbind the header from an element (Clear data when coming to that page)
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_unbindHeader: function () {
			var oHeader = this.getView();
			oHeader.unbindElement();
		},

		/**
		 * Helper function to switch between load and unload truck icon
		 * @param {Boolean} bLoadTruck Flag indicating if truck is being loaded or not 
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		truckIconLeft: function (bLoadTruck) {
			if (bLoadTruck === true) {
				return "sap-icon://arrow-right";
			} else if (bLoadTruck === false) {
				return "sap-icon://arrow-left";
			} else {
				return "";
			}
		},

		/**
		 * Helper function to switch between load and unload truck icon
		 * @param {Boolean} bLoadTruck Flag indicating if truck is being loaded or not 
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */

		/* ==============================================================================================================================
		 * For all Tables
		 * ============================================================================================================================== */

		firstDigits: function (sHuNumber) {
			if (sHuNumber.indexOf("DUMMY") !== -1) {
				return "";
			}
			var iLength = sHuNumber.length,
				iEnd = iLength - 5,
				sFirstDigits = sHuNumber.substring(0, iEnd);

			return sFirstDigits;
		},

		lastDigits: function (sHuNumber) {
			if (sHuNumber.indexOf("DUMMY") !== -1) {
				return "";
			}
			var iLength = sHuNumber.length,
				iStart = iLength - 5,
				sLastDigits = sHuNumber.substring(iStart);

			return sLastDigits;
		},

		dateConverter: function (scanDate) {
			var dateFormatter = new Intl.DateTimeFormat('en-GB', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
			var formattedDate = dateFormatter.format(scanDate);

			return formattedDate;
		},
		timeConverter: function (scanTime) {
			function msToTime(duration) {
				var milliseconds = parseInt((duration % 1000) / 100),
					seconds = Math.floor((duration / 1000) % 60),
					minutes = Math.floor((duration / (1000 * 60)) % 60),
					hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

				hours = (hours < 10) ? "0" + hours : hours;
				minutes = (minutes < 10) ? "0" + minutes : minutes;
				seconds = (seconds < 10) ? "0" + seconds : seconds;

				return hours + ":" + minutes + ":" + seconds;
			}
			var milliseconds = scanTime.ms;
			var formattedTime = msToTime(milliseconds);
			return formattedTime;
		},

		getLoadNumber: function (sLoadNumber) {
			if (sLoadNumber === null || sLoadNumber === " " || sLoadNumber === "") {
				sLoadNumber = this._sLoadNumber;
			} else {
				if (this._sGate === this._oViewModel.getProperty("/Gate")) {
					if (sLoadNumber === "") {
						sLoadNumber = this._sLoadNumber;
					} else {
						this._sLoadNumber = sLoadNumber;
					}
				} else {
					this._sLoadNumber = sLoadNumber;
					this._sGate = this._oViewModel.getProperty("/Gate")
				}
			}
			return sLoadNumber;
		},

/* 		putIntoLocalStorage: function (sValue) {
			var oDataModel = this._oStore.get("localStorage");
			oDataModel = sValue;
			this._oStore.put("localStorage", oDataModel);
		}, */

		getLocalStorage: function () {
			this._loadLeftTableItemsPreviousSession();
			this._loadMiddleTableItems();
			this._loadRightTableItems();
		},

		/* ==============================================================================================================================
		 * Left Table
		 * ============================================================================================================================== */

		/**
		 * Reads out filter values and loads items for the left table
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_loadLeftTableItems: function () {
			// Load Left Table entries
			var oLeftTable = this._oLeftTable, 
				oLeftTableBindingInfo = oLeftTable.getBindingInfo("items"),
				oDataModel = this.getModel(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				aFilters = [
					new Filter("WarehouseNo", FilterOperator.EQ, sWarehouseNo),
					new Filter("Gate", FilterOperator.EQ, sGate)
				];

			// Fetch total count using $count
			var sPath = oLeftTableBindingInfo.path + "/$count";
			var that = this;
			var oDummyLeftTable = this._oDummyLeftTable;

			// Create a JSON model with 10 fake rows
			var oFakeData = {
				dummyLeftRows: [{
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}]
			};
			var oJSONModel = new sap.ui.model.json.JSONModel();
			oJSONModel.setData(oFakeData);
			oDataModel.read(sPath, {
				filters: aFilters,
				success: function (iCount) {
					that._oViewModel.setProperty("/LeftTableCount", iCount);
					that._oViewModel.setProperty("/CountCurrent", iCount);
					that._iCountLeft = iCount;
					if (iCount > 0 && iCount < 10) {
						that.getView().byId("oDummyLeftTable").setVisible(true);
						oFakeData.dummyLeftRows.splice(0, iCount);
						oJSONModel.setData(oFakeData);
						that.getView().setModel(oJSONModel, "dummyLeftModel");
						that.getView().byId("oDummyLeftTable").setModel(that.getView().getModel("dummyLeftModel"));
						oDummyLeftTable.getBinding("items").getModel().updateBindings(true);
					} else {
						that.getView().byId("oDummyLeftTable").setVisible(false);
					}
				},
				error: function () {}
			});

			oLeftTable.bindItems({
				path: oLeftTableBindingInfo.path,
				template: oLeftTableBindingInfo.template,
				filters: aFilters,
				events: {
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							oLeftTable.setBusy(true);
						});
					},
					dataReceived: function (oData) {
						oLeftTable.setBusy(false);
					}
				}
			});
		},

		_loadLeftTableItemsPreviousSession: function () {
			// Load Left Table entries
			var oLeftTable = this._oLeftTable,
				oLeftTableBindingInfo = oLeftTable.getBindingInfo("items"),
				oDataModel = this.getModel(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				aFilters = [
					new Filter("WarehouseNo", FilterOperator.EQ, sWarehouseNo),
					new Filter("Gate", FilterOperator.EQ, sGate)];

			// Fetch total count using $count
			var sPath = oLeftTableBindingInfo.path + "/$count";
			var that = this;
			var oDummyLeftTable = this._oDummyLeftTable;

			// Create a JSON model with 10 fake rows
			var oFakeData = {
				dummyLeftRows: [{
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}]
			};
			var oJSONModel = new sap.ui.model.json.JSONModel();
			oJSONModel.setData(oFakeData);

			oDataModel.read(sPath, {
				filters: aFilters,
				success: function (iCount) {
					that._oViewModel.setProperty("/LeftTableCount", iCount);
					that._oViewModel.setProperty("/CountCurrent", iCount);
					that._iCountLeft = iCount;
					if (iCount > 0 && iCount < 10) {
						that.getView().byId("oDummyLeftTable").setVisible(true);
						oFakeData.dummyLeftRows.splice(0, iCount);
						oJSONModel.setData(oFakeData);
						that.getView().setModel(oJSONModel, "dummyLeftModel");
						that.getView().byId("oDummyLeftTable").setModel(that.getView().getModel("dummyLeftModel"));
						oDummyLeftTable.getBinding("items").getModel().updateBindings(true);
					} else {
						that.getView().byId("oDummyLeftTable").setVisible(false);
					}
				},
				error: function () {}
			});

			oLeftTable.bindItems({
				path: oLeftTableBindingInfo.path,
				template: oLeftTableBindingInfo.template,
				filters: aFilters,
				events: {
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							oLeftTable.setBusy(true);
						});
					},
					dataReceived: function (oData) {
						oLeftTable.setBusy(false);
						that._bindHeaderPreviousSession();
						that.onOpenDialogPreviousSession();
					}
				}
			});
		},

		/**
		 * Event function when data for table was loaded
		 * Changes background color of table and calculates number of list items
		 * @param {sap.ui.base.Event} oEvent  
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onLeftTableUpdateFinished: function (oEvent) {
			var oTable = oEvent.getSource();
			window.setTimeout(function () {
				var aItems = oTable.getItems(),
					bShowError = false,
					iLength = 0;

				for (var i = 0; i < aItems.length; i++) {
					var oItem = aItems[i],
						oContext = oItem.getBindingContext(),
						oModel = oContext.getModel(),
						sPath = oContext.getPath(),
						oData = oModel.getProperty(sPath);

					// Reset background color
					// oItem.removeStyleClass("red");
					// oItem.removeStyleClass("green");
					// oItem.removeStyleClass("yellow");

					// Set background color
					if (oData.Status === "G") {
						// oItem.addStyleClass("green");
						oItem.$().css("background-color", this._sSuccess);
					} else if (oData.Status === "Y") {
						// oItem.addStyleClass("yellow");
						oItem.$().css("background-color", this._sWarning);
					} else {
						// oItem.addStyleClass("red");
						oItem.$().css("background-color", this._sError);
						bShowError = true;
					}
					// Count how many items have HuNumber
					if (oData.Status !== "Y") {
						iLength += 1;
					}
				}

				if (bShowError) {
					this._enableErrorPane();
				} else {
					this._disableErrorPane();
				}
			}.bind(this), 50);
			// }
		},

		/**
		 * Changes model to show error message strip
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_enableErrorPane: function () {
			var oModel = this.getView().getModel("monitorView");
			oModel.setProperty("/errorFound", true);
		},

		/**
		 * Changes model to hide error message strip
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_disableErrorPane: function () {
			var oModel = this.getView().getModel("monitorView");
			oModel.setProperty("/errorFound", false);
		},

		/* ==============================================================================================================================
		 * Middle Table
		 * ============================================================================================================================== */

		_loadMiddleTableItems: function () {
			// Load Middle Table entries
			var oMiddleTable = this._oMiddleTable, 
				oMiddleTableBindingInfo = oMiddleTable.getBindingInfo("items"),
				oDataModel = this.getModel(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				aFilters = [
					new Filter("WarehouseNo", FilterOperator.EQ, sWarehouseNo),
					new Filter("Gate", FilterOperator.EQ, sGate)
				];

			// Fetch total count using $count
			var sPath = oMiddleTableBindingInfo.path + "/$count";
			var iTotalCount = 0;
			var that = this;
			var oDummyMiddleTable = this._oDummyMiddleTable;
			// Create a JSON model with 10 fake rows
			var oFakeData = {
				dummyMiddleRows: [{
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}]
			};
			var oJSONModel = new sap.ui.model.json.JSONModel();
			oJSONModel.setData(oFakeData);
			oDataModel.read(sPath, {
				filters: aFilters,
				success: function (iCount) {
					that._oViewModel.setProperty("/CenterTableCount", iCount);
					that._iCountTotal = Number(that._iCountLeft) + Number(iCount);
					that._oViewModel.setProperty("/CountTotal", that._iCountTotal);
					if (iCount > 0 && iCount < 10) {
						that.getView().byId("oDummyMiddleTable").setVisible(true);
						oFakeData.dummyMiddleRows.splice(0, iCount);
						oJSONModel.setData(oFakeData);
						that.getView().setModel(oJSONModel, "dummyMiddleModel");
						that.getView().byId("oDummyMiddleTable").setModel(that.getView().getModel("dummyMiddleModel"));
						oDummyMiddleTable.getBinding("items").getModel().updateBindings(true);
					} else {
						that.getView().byId("oDummyMiddleTable").setVisible(false);
					}
				},
				error: function () {}
			});

			oMiddleTable.bindItems({
				path: oMiddleTableBindingInfo.path,
				template: oMiddleTableBindingInfo.template,
				filters: aFilters,
				events: {
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							oMiddleTable.setBusy(true);
						});
					},
					dataReceived: function (oData) {
						oMiddleTable.setBusy(false);
					}
				}
			});
		},

		/**
		 * Event function when data for table was loaded
		 * Changes background color of table and calculates number of list items
		 * @param {sap.ui.base.Event} oEvent  
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onMiddleTableUpdateFinished: function (oEvent) {
			
		},

		
		/* ==============================================================================================================================
		 * Right Table
		 * ============================================================================================================================== */

		/**
		 * Reads out filter values and loads items for the error table
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_loadRightTableItems: function () {
			// Load Error Table entries
			var oErrorTable = this._oRightTable, //this.getView().byId("idErrorTable"),
				oErrorTableBindingInfo = oErrorTable.getBindingInfo("items"),
				oDataModel = this.getModel(),
				//sAlias = this._oViewModel.getProperty("/SAP__Origin"),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				aFilters = [
					//new Filter("SAP__Origin", FilterOperator.EQ, sAlias),
					new Filter("WarehouseNo", FilterOperator.EQ, sWarehouseNo),
					new Filter("Gate", FilterOperator.EQ, sGate)
				];

			// Fetch total count using $count
			var sPath = oErrorTableBindingInfo.path + "/$count";
			var iTotalCount = 0;
			var that = this;
			var oDummyRightTable = this._oDummyRightTable;
			// Create a JSON model with 10 fake rows
			var oFakeData = {
				dummyRightRows: [{
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}, {
					Value: "|"
				}]
			};
			var oJSONModel = new sap.ui.model.json.JSONModel();
			oJSONModel.setData(oFakeData);
			oDataModel.read(sPath, {
				filters: aFilters,
				success: function (iCount) {
					that._oViewModel.setProperty("/ErrorTableCount", iCount);
					if (iCount > 0 && iCount < 10) {
						that.getView().byId("oDummyRightTable").setVisible(true);
						oFakeData.dummyRightRows.splice(0, iCount);
						oJSONModel.setData(oFakeData);
						that.getView().setModel(oJSONModel, "dummyRightModel");
						that.getView().byId("oDummyRightTable").setModel(that.getView().getModel("dummyRightModel"));
						oDummyRightTable.getBinding("items").getModel().updateBindings(true);
					} else {
						that.getView().byId("oDummyRightTable").setVisible(false);
					}
				},
				error: function () {}
			});
			oErrorTable.bindItems({
				path: oErrorTableBindingInfo.path,
				template: oErrorTableBindingInfo.template,
				filters: aFilters,
				events: {
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							oErrorTable.setBusy(true);
						});
					},
					dataReceived: function (oData) {
						oErrorTable.setBusy(false);
					}
				}
			});
		},

		/**
		 * Event function when data for table was loaded
		 * Changes background color of table and calculates number of list items
		 * @param {sap.ui.base.Event} oEvent  
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onRightTableUpdateFinished: function (oEvent) {
			var oTable = oEvent.getSource();
			window.setTimeout(function () {
				var aItems = oTable.getItems();
				this._oViewModel.setProperty("/ErrorTableCount", aItems.length);

				for (var i = 0; i < aItems.length; i++) {
					var oItem = aItems[i],
						oContext = oItem.getBindingContext(),
						oModel = oContext.getModel(),
						sPath = oContext.getPath(),
						oData = oModel.getProperty(sPath);

					// oItem.addStyleClass("red");
					if (oData.Status === "Y") {
						// oItem.addStyleClass("yellow");
						oItem.$().css("background-color", this._sWarning);
					} else {
						oItem.$().css("background-color", this._sError);
					}
				}

			}.bind(this), 50);
			// }
		},

		/* ==============================================================================================================================
		 * Helper methods
		 * ============================================================================================================================== */

		/**
		 * Binds the app to the ABAP Push channel
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		initAbapChannel: function () {

			var oWebSocket,
				webSocketURI = "/sap/bc/apc/rb4r/lo_rfid_load_monitor_apc"; 
			try {
				oWebSocket = new SapPcpWebSocket(webSocketURI, SapPcpWebSocket.SUPPORTED_PROTOCOLS.v10);

				oWebSocket.attachOpen(function (oEvent) {
					MessageToast.show("Websocket connection opened");
				});
				oWebSocket.attachClose(function (oEvent) {
					MessageToast.show("Websocket connection closed");
					var oCloseParams = oEvent.getParameters();
					window.setTimeout(function () {
						// If we intentionally close the Push channel, we close it with specific code and reason
						if (oCloseParams.code !== this._iCloseCode || oCloseParams.reason !== this._sCloseReason) {
							// If this._oWebSocket is not null, we did not intend to close WebSocket
							if (this._oWebSocket !== null) {
								// try to open new WebSocket
								this.initAbapChannel();
							}
						}
					}.bind(this), 1000);
					// }.bind(this));
				}, this);
				oWebSocket.attachMessage(function (oEvent) {
					if (oEvent.getParameter("pcpFields").errorText) {
						// Message is an error text
						return;
					}
					// Parse Message
					var oEntry = JSON.parse(oEvent.getParameter("data")),
						sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
						sGate = this._oViewModel.getProperty("/Gate");
					// if oEntry is for me, get new data
					if (oEntry.hasOwnProperty("WarehouseNo") && oEntry.WarehouseNo === sWarehouseNo &&
						oEntry.hasOwnProperty("GATE") && oEntry.GATE === sGate) {
						this._handlePushReceived(oEntry);
					}
				}, this);

				this._oWebSocket = oWebSocket;
			} catch (exception) {
				this._oWebSocket = null;
				
				
			}
		},
		_initJson: function(){
			let _oEntry = {};			
			_oEntry.GATE = "R002"; 
            _oEntry.WarehouseNo =  "6230";
            _oEntry.NEWDATAAVAILABLE =  "X";
            _oEntry.HULOADEDSUCCESS =  "";
            _oEntry.HULOADEDWRONGHU =  "X";
            _oEntry.FONOTRELEASED =  "";
            _oEntry.SPECIFICTIMEMSG =  "5000";
            _oEntry.DELAYLOADINNGNEWDATA =  "";
			_oEntry.RELEASELOADINGFO =  "";
			return _oEntry;
		},
		_triggerJson: function(){
			 let _oEntry = {};			
			_oEntry.GATE = "R002"; 
            _oEntry.WarehouseNo =  "6230";
            _oEntry.NEWDATAAVAILABLE =  "X";
            _oEntry.HULOADEDSUCCESS =  "X";
            _oEntry.HULOADEDWRONGHU =  "";
            _oEntry.FONOTRELEASED =  "";
            _oEntry.SPECIFICTIMEMSG =  "10000";
            _oEntry.DELAYLOADINNGNEWDATA =  "X";
			_oEntry.RELEASELOADINGFO =  "";
			return _oEntry;
		},
		_triggerMessage: function(oEvent){
			let oEntry = this._triggerJson();
			this._handlePushReceived(oEntry);
		},
		_triggerMessageInit: function(oEvent){
			let oEntry = this._initJson();
			this._handlePushReceived(oEntry);
		},
		/**
		 * Called when push notification was sent
		 * Wrapper function to call all the laod data functions
		 * @param {Object} oEntry  
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_handlePushReceived: function (oEntry) {
			// Check if monitor is currently locked
/* 			if (this._oViewModel.getProperty("/bLockMonitor")) {
				// If STOPLOAD = false, show the user to continue loading
				if (oEntry.hasOwnProperty("STOPLOAD") && oEntry.STOPLOAD === "") {
					this.onHandleContinueLoad();
				}
				// If it's locked don't do anything
				return;
			}
 */
			// Close all open Dialogs
			InstanceManager.closeAllDialogs();
			this._oViewModel.setProperty("/E_MessageInfor", "");
			// Check if error occured on header
			/* if (oEntry.hasOwnProperty("HEADERERROR") && oEntry.HEADERERROR === "X") {
				this._handleError();
			} else if ((oEntry.hasOwnProperty("LOADINGSTART") && oEntry.LOADINGSTART === "X") || (oEntry.hasOwnProperty("GATECHANGED") &&
					oEntry.GATECHANGED === "X")) { //|| (oEntry.LOADINGSTART === "" && this._getDialog().isOpen())
				this._resetView();
				this.onOpenDialog();
			} else if (oEntry.hasOwnProperty("STOPLOAD") && oEntry.STOPLOAD === "X") {
				this.onHandleStopLoad();
			} else if (oEntry.hasOwnProperty("PICTURESTORED") && oEntry.PICTURESTORED === "X") {
				this.onOpenPhotoDialog();
			} else if (oEntry.hasOwnProperty("HULOADEDWAITFORPIC") && oEntry.HULOADEDWAITFORPIC === "X") {
				this.onOpenWaitForPicDialog();
			} else if (oEntry.hasOwnProperty("USERLOCKSLOAD") && oEntry.USERLOCKSLOAD === "X") {
				this.onOpenUserLocksLoad();
			} else if (oEntry.hasOwnProperty("LOADCOMPLETED") && oEntry.LOADCOMPLETED === "X") {
				this.onLoadCompleted(); */
			//debugger;	
			 if (oEntry.hasOwnProperty("NEWDATAAVAILABLE") && oEntry.NEWDATAAVAILABLE === "X") {
				// // Prepare next call
				// this._copyLastToSecondLastTable();
				// start next call to load data
				//this._loadNewData();
				let sMessage = "";		
				if(oEntry.hasOwnProperty("HULOADEDSUCCESS") && oEntry.HULOADEDSUCCESS === "X" )
				{
					sMessage = this.getResourceBundle().getText("msgHuLoadedSuccess");
					if(oEntry.DELAYLOADINNGNEWDATA === "X"){
						this._showDialogMessage(sMessage,DialogType.Message,ValueState.Success,oEntry.SPECIFICTIMEMSG,oEntry.DELAYLOADINNGNEWDATA);
					}
					else{		
						this._loadNewData();
						this._showDialogMessage(sMessage,DialogType.Message,ValueState.Success,oEntry.SPECIFICTIMEMSG);
					}	
				}
				else if(oEntry.hasOwnProperty("HULOADEDWRONGHU") && oEntry.HULOADEDWRONGHU === "X" )
				{
					sMessage = this.getResourceBundle().getText("msgHuLoadedWrongHu");
					if(oEntry.DELAYLOADINNGNEWDATA === "X"){
						this._showDialogMessage(sMessage,DialogType.Message,ValueState.Error,oEntry.SPECIFICTIMEMSG,oEntry.DELAYLOADINNGNEWDATA);
					}
					else{
							this._loadNewData();
							this._showDialogMessage(sMessage,DialogType.Message,ValueState.Error,oEntry.SPECIFICTIMEMSG);
					}									
				}
				else if(oEntry.hasOwnProperty("FONOTRELEASED") && oEntry.FONOTRELEASED === "X" )
					{
						sMessage = this.getResourceBundle().getText("msgFoNotReleased");
						if(oEntry.DELAYLOADINNGNEWDATA === "X"){
							this._showDialogMessage(sMessage,DialogType.Message,ValueState.Warning,oEntry.SPECIFICTIMEMSG,oEntry.DELAYLOADINNGNEWDATA);
						}
						else{
							this._loadNewData();
							this._showDialogMessage(sMessage,DialogType.Message,ValueState.Warning,oEntry.SPECIFICTIMEMSG);
						}
						
					}	
				else if(oEntry.hasOwnProperty("RELEASELOADINGFO") && oEntry.RELEASELOADINGFO === "X" )
					{
						this._loadNewData();
						this.onCloseDialogMessage();
						this.onOpenDialogPreviousSession();
					}	
				else{

					this.onCloseDialogMessage();
					this._loadNewData();
				}				
			} 
			/* else if (oEntry.hasOwnProperty("POSTGOODSISSUEPROGRESS") && oEntry.POSTGOODSISSUEPROGRESS === "X") {
				this._showPostGooodsIssueProgress(oEntry);
			} else if (oEntry.hasOwnProperty("POSTGOODSISSUEDONE") && oEntry.POSTGOODSISSUEDONE === "X") {
				this._showPostGooodsIssueDone();
			} else if (oEntry.hasOwnProperty("FLAGPIC")) {
				this._showPictureStatus(oEntry.FLAGPIC);
			} */
		},

		/**
		 * Show dialog message 
		 * 
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_showDialogMessage: function(a,b,c,d,e){
			this._oViewModel.setProperty("/E_MessageInfor", a);
			this._oViewModel.setProperty("/DialogType", b);
			this._oViewModel.setProperty("/ValueState", c);			
			this._oViewModel.setProperty("/SPECIFICTIMEMSG", d);	
			this.onCloseDialogMessage();
			this.onOpenDialogMessage(e);	
		},
		/**
		 * Called when push notification was sent and contains NEWDATAAVAILABLE === "X"
		 * Load new data
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_loadNewData: function() {
			this._loadLeftTableItems();
			this._loadMiddleTableItems();
			this._loadRightTableItems();
			this._bindHeader();		
		},
		/**
		 * Called when push notification was sent and contains the error flag
		 * Reads the HeaderLineSet and then gets the ErrorMessage from the structure to display it to the user
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_handleError: function () {
			this.getModel().metadataLoaded()
				.then(function () {
					var sGate = this._oViewModel.getProperty("/Gate"),
						sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
						sHeaderInfoKey = this.getModel().createKey("/HeaderLineSet", {
							WarehouseNo: sWarehouseNo,
							Gate: sGate
						});
					this.getModel().read(sHeaderInfoKey, {
						success: function (oData) {
							MessageBox.error(
								oData.ErrorMessage, {
									styleClass: this.getOwnerComponent().getContentDensityClass(),
									actions: [sap.m.MessageBox.Action.CLOSE]
								}
							);
						}.bind(this),
						error: function () {}
					});
				}.bind(this));
		},

		/**
		 * Called when route was matched
		 * Gets the Success, Warning and Error background color code from the theming object
		 * and stores it in this controller so that the data received functions can take it
		 * to color the background of table entries.
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_createBackgroundColor: function () {
			this.getModel().metadataLoaded().then(function () {			
				window.setTimeout(function () {
					if (sap.ui.core && sap.ui.core.theming && sap.ui.core.theming.Parameters) {
						var sError = sap.ui.core.theming.Parameters.get("sapErrorBackground"),
							sWarning = sap.ui.core.theming.Parameters.get("sapWarningBackground"),
							sSuccess = sap.ui.core.theming.Parameters.get("sapSuccessBackground");
						if (sError) {
							this._sError = sError;
						}
						if (sWarning) {
							this._sWarning = sWarning;
						}
						if (sSuccess) {
							this._sSuccess = sSuccess;
						}
					}
				}.bind(this), 50);
			}.bind(this));
		},

		/**
		 * Call this method when screen needs to be reset
		 * Resets the Header and the tables
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_resetView: function () {
			this._unbindHeader();
			this._oLeftTable.destroyItems();
			this._oMiddleTable.destroyItems();
			this._oRightTable.destroyItems();
			this._oDummyLeftTable.destroyItems();
			this._oDummyMiddleTable.destroyItems();
			this._oDummyRightTable.destroyItems();
		},

		/* ==============================================================================================================================
		 * Popup methods
		 * ============================================================================================================================== */

		/**
		 * Returns the Popup Dialog
		 * Lazily loads and creates the Dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_getDialog: function () {
			// create dialog lazily
			if (!this._oDialog) {
				// create dialog via fragment factory
				this._oDialog = sap.ui.xmlfragment("com.bosch.rbf0.lo.rfidlc.view.fragment.PopupInitialScreen", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oDialog);
			}
			return this._oDialog;
		},

		/**
		 * Returns the Popup Dialog Message
		 * Lazily loads and creates the Dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_getDialogMessage: function () {
			// create dialog lazily
			//debugger;
			if (!this._oDialogMessage ) {
				// create dialog via fragment factory
				this._oDialogMessage  = sap.ui.xmlfragment("com.bosch.rbf0.lo.rfidlc.view.fragment.PopupMessageScreen", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oDialogMessage);
			}
			return this._oDialogMessage;
		},
		/**
		 * Opens the Dialog and binds the Dialog to the oData service
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenDialogMessage: function (a) {
			var _oDialog= this._getDialogMessage();
			_oDialog.open(); 
			var _delayTime = 	this._oViewModel.getProperty("/SPECIFICTIMEMSG");
			_delayTime =  ( _delayTime == undefined ) ? 5000 : _delayTime;
			this.myTimeoutId = setTimeout(function() {
				if (this._oDialogMessage && this._oDialogMessage.isOpen()) { // Check if dialog exists and is open before closing					
					this._oDialogMessage.close();				
					// call to get new data
					if(a === "X"){
						//debugger;
						this._loadNewData();						
					}
				}
			 this.myTimeoutId = null;
			}.bind(this), _delayTime); // Ensure 'this' context is correct
		},
		/**
		 * Cancel timeout
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onCancelTimeoutId: function() {
            // Clear the timeout when a button is pressed
            if (this.myTimeoutId) {
                clearTimeout(this.myTimeoutId);
                //console.log("Timeout successfully cancelled.");
                this.myTimeoutId = null; // Clear the stored ID
            }
        },

		onExit: function() {
            // Clear the timeout when the view is destroyed to prevent memory leaks
            if (this.myTimeoutId) {
                clearTimeout(this.myTimeoutId);
                this.myTimeoutId = null;
            }
        },
		/**
		 * Opens the Dialog and binds the Dialog to the oData service
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenDialog: function () {
			var oDialog = this._getDialog(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				sHeaderInfoKey = this.getModel().createKey("/HeaderLineSet", {
					WarehouseNo: sWarehouseNo,
					Gate: sGate
				});
				/* oBinding = oDialog.getElementBinding(),
				sPath;

			// If binding is already set with current path
			// Refresh the binding to trigger a call to backend again
			debugger;
			if (oBinding !== undefined) {
				sPath = oBinding.getPath();
				if (sPath === sHeaderInfoKey) {
					oBinding.refresh(true);
					oDialog.open();
					return;
				}
			}
			oDialog.bindElement(sHeaderInfoKey);
			oDialog.open(); */
			var aFilters = [];
			let aFilter = {};
			aFilter = new sap.ui.model.Filter({
				path: "WarehouseNo",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sWarehouseNo
			});	 
			aFilters.push(aFilter);
			aFilter = new sap.ui.model.Filter({
				path: "Gate",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sGate
			});	 
			aFilters.push(aFilter);
			this.setBusy(true);
			this.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  []);
			var that = this;
			this.getHeaderLineSet(aFilters,sHeaderInfoKey).then(
				function (aData) {
					//debugger;
					that.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  aData);
					this.setBusy(false);
				}.bind(this),
				function (oError) { this.setBusy(false); }.bind(this)
			);
			oDialog.open(); 
		},

		/**
		 * Opens the Dialog and binds the Dialog to the oData service
		 * Only for refreshing or loading previous session
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenDialogPreviousSession: function () {
			var oDialog = this._getDialog(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				sHeaderInfoKey = this.getModel().createKey("/HeaderLineSet", {
					WarehouseNo: sWarehouseNo,
					Gate: sGate
				});
			/* 	oBinding = oDialog.getElementBinding(),
				sPath;
			// If binding is already set with current path
			// Refresh the binding to trigger a call to backend again
			debugger;
			if (oBinding !== undefined) {
				sPath = oBinding.getPath();
				if (sPath === sHeaderInfoKey) {
					oBinding.refresh(true);
					var oHeader = this.getView();
					oHeader.unbindElement();
					if (this._iCountTotal !== 0 && this._isRefresh === 0) {
						//oDialog.open();
					} else if (this._iCountTotal === 0 && (this._isRefresh === 0 || this._isRefresh === 1)) {
						//oDialog.open();
					}
					//return;
				}
			}
			debugger;
			oDialog.bindElement(sHeaderInfoKey);
			if (this._iCountTotal !== 0 && this._isRefresh === 0) {
				oDialog.open();
			} else if (this._iCountTotal === 0 && (this._isRefresh === 0 || this._isRefresh === 1)) {
				oDialog.open();
			} */
				var aFilters = [];
				let aFilter = {};
				aFilter = new sap.ui.model.Filter({
					path: "WarehouseNo",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sWarehouseNo
				});	 
				aFilters.push(aFilter);
				aFilter = new sap.ui.model.Filter({
					path: "Gate",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sGate
				});	 
				aFilters.push(aFilter);
				this.setBusy(true);
				this.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  []);		
				var that = this;		
				this.getHeaderLineSet(aFilters,sHeaderInfoKey).then(
					function (aData) {
						//debugger;
						that.getModel("oHeaderLineModel").setProperty("/oHeaderLineSet",  aData);
						this.setBusy(false);
					}.bind(this),
					function (oError) { this.setBusy(false); }.bind(this)
				);
				oDialog.open();
		},

		/**
		 * Closes the dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onCloseDialog: function () {
			// Close dialog
			this._getDialog().close();
		},
        onCloseDialogMessage: function () {
			// Close dialog
			this._getDialogMessage().close();
			this.onCancelTimeoutId(this.myTimeoutId);
		},
		/* ==============================================================================================================================
		 * Stop working popups
		 * ============================================================================================================================== */

		/**
		 * Opens a dialog to inform user that he needs to stop working
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onHandleStopLoad: function () {
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("msgStopLoad");
			MessageBox.error(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
			// Set App to be blocked
			this._oViewModel.setProperty("/bLockMonitor", true);
		},

		/**
		 * Closes the Stop Load Popup and 
		 * Opens a dialog to inform user that he can continue working
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onHandleContinueLoad: function () {
			// Close all open Dialogs
			InstanceManager.closeAllDialogs();
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("msgContinueLoad");
			MessageBox.success(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
			// Set App to not locked
			this._oViewModel.setProperty("/bLockMonitor", false);
		},

		/* ==============================================================================================================================
		 * Photo popup
		 * ============================================================================================================================== */

		/**
		 * Returns the Popup Dialog Photo
		 * Lazily loads and creates the Photo Dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_getPhotoDialog: function () {
			// create dialog lazily
			if (!this._oPhotoDialog) {
				// create dialog via fragment factory
				this._oPhotoDialog = sap.ui.xmlfragment("com.bosch.rbf0.lo.rfidlc.view.fragment.PopupPhoto", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oPhotoDialog);
			}
			return this._oPhotoDialog;
		},

		/**
		 * Opens the Dialog and binds the Dialog to the oData service
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenPhotoDialog: function () {
			var oDialog = this._getPhotoDialog(),
				sGate = this._oViewModel.getProperty("/Gate"),
				sWarehouseNo = this._oViewModel.getProperty("/WarehouseNo"),
				sPhotoKey = this.getModel().createKey("/PhotoSet", {
					WarehouseNo: sWarehouseNo,
					Gate: sGate
				}),
				sPath = this.getModel().sServiceUrl + sPhotoKey + "/$value";

			//	sPath = "https://images.unsplash.com/photo-1536607278842-2e762f290252?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80";

			this._oViewModel.setProperty("/sPhoto", sPath);
			oDialog.open();
			window.setTimeout(function () {
				var oPDialog = this._getPhotoDialog(),
					iHeight = $("#" + oPDialog.getId() + "-cont").height();
				this._oViewModel.setProperty("/iPicHeight", (iHeight - 2 * 16) + "px");
			}.bind(this), 500);
		},

		/**
		 * Closes the dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onClosePhotoDialog: function () {
			// Close dialog
			this._getPhotoDialog().close();
		},

		/* ==============================================================================================================================
		 * Wait for picture popup
		 * ============================================================================================================================== */

		/**
		 * Opens the Dialog to inform users that they have to wait for Post goods issue
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenWaitForPicDialog: function () {
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("msgWaitForGI");
			MessageBox.information(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},
		/**
		 * Opens the Dialog to inform users that they have to wait for Post goods issue
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onDisplayMessage: function (sMessage) {
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				//sMessage = this.getResourceBundle().getText("msgWaitForGI");
			MessageBox.information(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},
		/**
		 * Opens the Dialog to inform users that they have to wait for Post goods issue
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onDisplayMessageWithTime: function (sMessage,_sTime) {
			// Show the popup			
			_sTime =  ( _sTime == undefined ) ? 5000 : _sTime;
			sap.m.MessageToast.show(sMessage, {
				duration: _sTime // Display for the specific time based on _sTime
				});
		},
		/**
		 * Opens the Dialog and informs users that the load is being changed
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onOpenUserLocksLoad: function () {
			var oHeader = this.getView(),
				oBinding = oHeader.getElementBinding(),
				sPath = oBinding.getPath(),
				oData = this.getModel().getProperty(sPath),
				sLoadNumber = oData.LoadNumber;
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("msgUserLocksLoad", [sLoadNumber]);
			MessageBox.error(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},

		/**
		 * Opens the Dialog and informs users that the load is completed and goods issue posted
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		onLoadCompleted: function () {
			var oHeader = this.getView(),
				oBinding = oHeader.getElementBinding(),
				sPath = oBinding.getPath(),
				oData = this.getModel().getProperty(sPath),
				sLoadNumber = oData.LoadNumber;
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("msgLoadCompleted", [sLoadNumber]);
			MessageBox.information(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},

		/* ==============================================================================================================================
		 * Post Goods Issue Progress
		 * ============================================================================================================================== */

		/**
		 * Returns the Popup Post Goods Issue Progress Dialog
		 * Lazily loads and creates the Post Goods Issue Progress Dialog
		 * @memberOf ./rfidloadctrl.view.Monitor
		 */
		_getPostGoodsIssueProgressDialog: function () {
			// create dialog lazily
			if (!this._oPostGoodsIssueProgressDialog) {
				// create dialog via fragment factory
				this._oPostGoodsIssueProgressDialog = sap.ui.xmlfragment("com.bosch.rbf0.lo.rfidlc.view.fragment.PopupPostGoodsIssue",
					this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oPostGoodsIssueProgressDialog);
			}
			return this._oPostGoodsIssueProgressDialog;
		},

		_showPostGooodsIssueProgress: function (oEntry) {
			var oDialog = this._getPostGoodsIssueProgressDialog(),
				iProcessed, iTotal, fPercentage, iPercentage;
			if (oEntry.hasOwnProperty("PROCESSED") && oEntry.hasOwnProperty("TOTAL")) {
				try {
					iProcessed = parseInt(oEntry.PROCESSED, 10);
					iTotal = parseInt(oEntry.TOTAL, 10);
					fPercentage = iProcessed / iTotal * 100;
					iPercentage = Math.round(fPercentage);
					this._oViewModel.setProperty("/PGI/percentage", iPercentage);
					var sDisplayText = this.getResourceBundle().getText("popupPGImessage", [iProcessed, iTotal]);
					this._oViewModel.setProperty("/PGI/displayText", sDisplayText);
					var sProgressText = this.getResourceBundle().getText("popupPGIProgressBar", [iPercentage]);
					this._oViewModel.setProperty("/PGI/progressText", sProgressText);
					oDialog.open();
					window.setTimeout(function () {
						this._getPostGoodsIssueProgressDialog().getEndButton().focus();
					}.bind(this), 500);
				} catch (e) {
					return;
				}
			}
		},

		onClosePGIDialog: function () {
			// Close dialog
			this._getPostGoodsIssueProgressDialog().close();
		},

		/* ==============================================================================================================================
		 * Post Goods Issue Done
		 * ============================================================================================================================== */
		_showPostGooodsIssueDone: function () {
			// Show the popup
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length,
				sMessage = this.getResourceBundle().getText("popupMsgPGIDone");
			MessageBox.information(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},

		/* ==============================================================================================================================
		 * Show Picture Status
		 * ============================================================================================================================== */
		_showPictureStatus: function (sFlagPic) {
			var sMessage = null;

			if (sFlagPic === "N" ||
				sFlagPic === "A") {
				sMessage = this.getResourceBundle().getText("popupMSGFlagPicArchive");
			} else if (sFlagPic === "R" ||
				sFlagPic === "B") {
				sMessage = this.getResourceBundle().getText("popupMSGFlagPicLoad");
			}

			if (sMessage !== null) {
				// Show the popup
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				MessageBox.information(
					sMessage, {
						styleClass: bCompact ? "sapUiSizeCompact" : ""
					}
				);
			}
		}
	});
});