sap.ui.define([], function() {
	"use strict";

	return {
		showInfo: function(sCarrier) {
			if (sCarrier && sCarrier.length > 0) {
				return false;
			}
			return true;
		},
		showForm: function(sCarrier) {
			if (sCarrier && sCarrier.length > 0) {
				return true;
			}
			return false;
		}
	};
});