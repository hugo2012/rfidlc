sap.ui.define([
	"com/bosch/rbf0/lo/rfidlc/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function(Controller, JSONModel) {
	"use strict";

	return Controller.extend("com.bosch.sd.rfidloadctrl.controller.App", {

		onInit: function() {
			var oViewModel,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				originalBusyDelay: iOriginalBusyDelay
			});
			this.setModel(oViewModel, "appView");

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}
	});
});