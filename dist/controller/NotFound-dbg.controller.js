sap.ui.define([
		"com/bosch/rbf0/lo/rfidlc/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("com.bosch.rbf0.lo.rfidlc.controller.NotFound", {
			
			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Event handler for link pressed event.
			 * It will replace the current entry of the browser history with the selectWorkstation route.
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("startup", {}, true);
				/*eslint-disable sap-no-history-manipulation*/
				history.go(0); // needed for reload
				/*eslint-enable sap-no-history-manipulation*/
			}
		});
	}
);