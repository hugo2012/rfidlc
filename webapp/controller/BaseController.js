/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function(Controller, History, MessageBox, MessageToast) {
	"use strict";

	return Controller.extend("com.bosch.rbf0.lo.rfidlc.controller.BaseController", {
		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function() {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function(sName) {
			var oModel = this.getView().getModel(sName);
			if(oModel) {
				return oModel;
			} else {
				return this.getOwnerComponent().getModel(sName);
			}
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function(oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function() {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("startup", {}, true);
			//	history.go(0);
			}
		},

		setAppBusy: function(bParam) {
			this.getModel("appView").setProperty("/busy", bParam);
		},
		
		showErrorBox: function(sMessageParam) {
			var sMessage = sMessageParam || this.getResourceBundle().getText("errorText"),
				bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;

			MessageBox.error(
				sMessage, {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				}
			);
		},
		setBusy: function (bBusy) {
			this.getView().setBusy(bBusy);
		},
		showMessage: function(sMsg) {
			MessageToast.show(sMsg);
		},
		
		/**
		 * Convenience method for getting the control inside fragment.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getFragmentControl: function(sFragmentId, sControlId) {
			return this.getView().byId(sap.ui.core.Fragment.createId(sFragmentId, sControlId));
		}
	});
});