sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function (UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("com.bosch.rbf0.lo.rfidlc.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias ./rfidloadctrl.controller.ErrorHandler
		 */
		constructor: function (oComponent) {
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			this._oModel.attachMetadataFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				this._showServiceError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(function (oEvent) {
				var oParams = oEvent.getParameters();
				if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf(
						"Cannot POST") === 0)) {
					this._showServiceError(oParams.response);
				}
			}, this);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError: function (sDetails) {
			if (this._bMessageOpen) {
				return;
			}
			var sErrorMsg = this._getErrorText(sDetails),
				sDisplayString = this._sErrorText + "\n\n" + sErrorMsg + "\n\n";
			this._bMessageOpen = true;
			MessageBox.error(
				sDisplayString, {
					id: "serviceErrorMessageBox",
					details: sDetails,
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.CLOSE],
					onClose: function () {
						this._bMessageOpen = false;
					}.bind(this)
				}
			);
		},

		_getErrorText: function (oData) {
		
			var sMessage = "",
				sDetailMessage = "",
				bConcatMessage = true;
			//if there is a responseText
			if (oData.responseText) {
				//the response is in JSON format most of the time, so try to parse it to get the detail message.
				try {
					for (var i = 0; i < JSON.parse(oData.responseText).error.innererror.errordetails.length; i++) {
						if (JSON.parse(oData.responseText).error.innererror.errordetails[i].code === "/IWBEP/CX_MGW_BUSI_EXCEPTION") {
							bConcatMessage = false;
						}
					}
					if (bConcatMessage) {
						sMessage = JSON.parse(oData.responseText).error.message.value;
					}
					if (JSON.parse(oData.responseText).error.innererror.errordetails.length > 0) {
						sDetailMessage = JSON.parse(oData.responseText).error.innererror.errordetails[0].message;
						while (sDetailMessage.indexOf("&") !== -1) {
							sDetailMessage = sDetailMessage.replace("&", "");
						}
					}
				}
				//... or XML, usually returned when there is a severe system failure
				catch (err) {
					var oMessage = jQuery.parseXML(oData.responseText);
					var XmlErrorMessage = jQuery(oMessage);
					sMessage = XmlErrorMessage.find("message").text();
				}

				return sMessage + " " + sDetailMessage;
			}
			
			return sMessage;
		},

		_parseXML: function (sText) {
			try {
				var xmlDoc = $.parseXML(sText),
					$xml = $(xmlDoc),
					$title = $xml.find("message");

				return $title.text();
			} catch (oError) {
				return null;
			}
		},

		_parseJson: function (sText) {
			var json = JSON.parse(sText);
			if (json) {
				return json.error.message.value;
			}
			return null;
		}
	});

});