sap.ui.define([
	"com/bosch/rbf0/lo/rfidlc/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/base/Log"
], function (Controller, JSONModel, Filter, FilterOperator, Log) {
	"use strict";

	return Controller.extend("com.bosch.rbf0.lo.rfidlc.controller.Startup", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onInit: function () {
			var oViewModel = new JSONModel({
				Gate: "",
				WarehouseNo: "",
				enableGate: false
			});
			this.setModel(oViewModel, "startupView");

			// Hook up the router
			this.getRouter().getRoute("startup").attachPatternMatched(this._onStartupMatched, this);
			this.getRouter().getRoute("startupAlias").attachPatternMatched(this._onStartupMatchedAlias, this);

		},

		/**
		 * Called when the route startupAlias is matched
		 * Sets the passed SAP__Origin value to the model and calls _onStartupMatched
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		_onStartupMatchedAlias: function (oEvent) {
			this._onStartupMatched();
		},

		/**
		 * Called when the route startup is matched
		 * Sets some field values and loads data from backend
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		_onStartupMatched: function () {
			
			this.setAppBusy(true);
			
			// Wait until metadata was loaded
			this.getModel().metadataLoaded()
				.then(function () {
					this.getModel().setSizeLimit(500);
					// Set the max length of the field according to length of $metadata
					var oInputWarehouseNo = this.getView().byId("idWarehouseNo");
					    oInputWarehouseNo.setMaxLength(4);
					// Set the max length of the field according to length of $metadata
					var oInputGate = this.getView().byId("idGate"),
						sMaxGate = this.getModel().getProperty("/#Gates/Gate/@maxLength"),
						iMaxGate = parseInt(sMaxGate, 10);
						oInputGate.setMaxLength(iMaxGate);

					// Load user parameters from backend and navigate to next page when set
					this._loadUserParameters().then(function (oData) {
							var aUserParams = oData.results,
								sWarehouseNo, sGate;
							for (var i = 0; i < aUserParams.length; i++) {
								if (sWarehouseNo !== undefined && sGate !== undefined ) {
									break;
								}
								var oParam = aUserParams[i];
								
								if (oParam.Field === "/RB4R/LO_LOAD_LGNUM") {
									sWarehouseNo = oParam.Value;
								}
								if (oParam.Field === "/RB4R/LO_LOAD_GATE") {
									sGate = oParam.Value;
								}
								
							}

							if (sWarehouseNo !== undefined && sGate !== undefined ) {
								this.getRouter().navTo("monitor", {
									//sapalias: sOrigin,
									WarehouseNo: sWarehouseNo,
									gate: sGate
								});
							}
							
							this.setAppBusy(false);

						}.bind(this),
						function () {
							Log.error("Error while loading user parameters");
							//jQuery.sap.log.error("Error while loading user parameters");
						});

				}.bind(this));

		},


		/* ==============================================================================================================================
		 * WarehouseNo Events
		 * ============================================================================================================================== */

		/**
		 * Called when user selects an item of the WarehouseNo suggestion list
		 * Loads the Gate Data
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onWarehouseNoSuggestionSelected: function (oEvent) {
			//var oSelItem = oEvent.getParameter("selectedItem");
			window.setTimeout(function () {
				this._loadGateData();
			}.bind(this), 100);
		},

		/**
		 * Called when user types in the WarehouseNo Input field
		 * Resets the Gate Input field
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onWarehouseNoLiveChange: function () {
			this.getModel("startupView").setProperty("/enableGate", false);
			this.getModel("startupView").setProperty("/Gate", "");
		},

		/**
		 * Called when user presses Enter on the WarehouseNo Input field
		 * Checks if user entered correct value and then calls to load Gate data
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onWarehouseNoSubmit: function () {
			var oModel = this.getModel("startupView"),
				sWarehouseNo = oModel.getProperty("/WarehouseNo");
			oModel.setProperty("/WarehouseNo", sWarehouseNo.toUpperCase());
			var bIsInContext = this._checkField("idWarehouseNo");

			// If enterd value is valid 
			// get the responding Gates
			if (bIsInContext) {
				this._loadGateData();
			}
		},

		/* ==============================================================================================================================
		 * Gate Events
		 * ============================================================================================================================== */

		/**
		 * Called when user selects an item of the Gate suggestion list
		 * Calls the go to next page function
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onGateSuggestionSelected: function () {

			window.setTimeout(function () {
				this.handleToMonitorPress();
			}.bind(this), 100);
		},

		/**
		 * Called when user presses Enter on the Gate Input field
		 * Calls the go to next page function
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		onGateSubmit: function () {
			var oModel = this.getModel("startupView"),
				sGate = oModel.getProperty("/Gate");
			oModel.setProperty("/Gate", sGate.toUpperCase());

			this.handleToMonitorPress();
		},

		/* ==============================================================================================================================
		 * Footer Events
		 * ============================================================================================================================== */

		/**
		 * Called when user presses Next button in footer
		 * Checks if all fields are filled correctly
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		handleToMonitorPress: function () {
			var bWarehouseNoCorrect = this._checkField("idWarehouseNo"),
				bGateCorrect = this._checkField("idGate");

			if (bWarehouseNoCorrect && bGateCorrect) {
				var sGate = this.getModel("startupView").getProperty("/Gate"),
					sWarehouseNo = this.getModel("startupView").getProperty("/WarehouseNo");
				this.getRouter().navTo("monitor", {
					WarehouseNo: sWarehouseNo,
					gate: sGate
				});
			}
		},

		/* ==============================================================================================================================
		 * Helper Methods
		 * ============================================================================================================================== */

		/**
		 * Checks if entered value in input field is present in suggestion item list
		 * Returns Boolean to indicate availability
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		_checkField: function (sField) {
			var oModel = this.getModel("startupView"),
				sWarehouseNo = oModel.getProperty("/WarehouseNo"),
				sGate = oModel.getProperty("/Gate"),
				oInput = this.getView().byId(sField), //"idWarehouseNo"
				oBindingInfo = oInput.getBindingInfo("suggestionItems"),
				aContexts = oBindingInfo.binding.getCurrentContexts(),
				bIsInContext = false,
				oDataModel = this.getModel();

			for (var i = 0; i < aContexts.length; i++) {
				var oContext = aContexts[i],
					oData = oDataModel.getProperty(oContext.sPath);

				if (sField === "idWarehouseNo") {
					if (oData.WarehouseNo === sWarehouseNo) {
						bIsInContext = true;
						break;
					}
				} else {
					if (oData.WarehouseNo === sWarehouseNo &&
						oData.Gate === sGate) {
						bIsInContext = true;
						break;
					}
				}
			}

			return bIsInContext;
		},

		/**
		 * Loads the the suggestion values for the Gate input field
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		_loadGateData: function () {
			var oModel = this.getModel("startupView"),
				sWarehouseNo = oModel.getProperty("/WarehouseNo"),
				oGateInput = this.getView().byId("idGate"),
				oBindingInfo = oGateInput.getBindingInfo("suggestionItems"),
				aFilters = [new Filter("WarehouseNo", FilterOperator.EQ, sWarehouseNo)],
				oDataModel = this.getModel();
			oGateInput.bindAggregation("suggestionItems", {
				path: oBindingInfo.path,
				template: oBindingInfo.template,
				filters: aFilters,
				events: {
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							oGateInput.setBusy(true);
						});
					},
					dataReceived: function () {
						oGateInput.setBusy(false);
						oModel.setProperty("/enableGate", true);
						window.setTimeout(function () {
							oGateInput.focus();
							oGateInput.fireSuggest({
								suggestValue: ""
							});
						}.bind(this), 100);
					}
				}
			});
		},

		/**
		 * Loads the the user parameters
		 * @memberOf ./rfidloadctrl.view.Startup
		 */
		_loadUserParameters: function () {
			// Creating a Deferred Object to get notified when backend call finished
			var oPromise = new Promise(function (fnResolve, fnReject) {
				// Create filters
			var	aFilters = [];
				// Reads the CheckDeliveryExist from the backend
				this.getModel().read("/UserDefaultParametersSet", {
					filters: aFilters,
					success: function (oData, oResponse) {
						fnResolve(oData);
					},
					error: function () {
						fnReject();
					}
				});
			}.bind(this));
			return oPromise;
		}
	});
});