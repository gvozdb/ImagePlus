/**
 * Copyright 2013 by Alan Pich <alan.pich@gmail.com>
 *
 * This file is part of ImagePlus
 *
 * ImagePlus is free software; you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation; either version 2 of the License, or (at your option) any later
 * version.
 *
 * ImagePlus is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * ImagePlus; if not, write to the Free Software Foundation, Inc., 59 Temple Place,
 * Suite 330, Boston, MA 02111-1307 USA
 *
 * @package ImagePlus
 * @author Alan Pich <alan.pich@gmail.com>
 * @copyright Alan Pich 2013
 */


ImagePlus.panel.input = function (config) {
    config = config || {};
    this.imageplus = config.imageplus;

    this.create_editButton();
    this.create_clearButton();
    this.create_imageBrowser();
    this.create_imagePreview();
    this.create_altTextField();

    // Warn if has no dependencies
    if (ImagePlus.config.has_unmet_dependencies) {
        ImagePlus.warnAboutUnmetDependencies()
    }


    Ext.apply(config, {
        border: false, baseCls: 'modx-formpanel', cls: 'container', updateTo: config.updateTo, width: '100%',
        items: [{
            xtype: 'compositefield', anchor: '98%', hideLabel: true,
            listeners: {
                'render': {fn: this.on_Render, scope: this},
                'afterRender': {fn: this.onAfterRender, scope: this}
            },
            items: [this.imageBrowser]
        }, {
            cls: 'modx-tv-image-preview',
            items: [
                this.editButton,
                this.clearButton
            ]
        },{
            cls: 'modx-tv-image-preview',
            items: [
                this.imagePreview,
                this.altTextField
            ]
        }]
    });
    ImagePlus.panel.input.superclass.constructor.call(this, config);


    this.listenForResetEvent();
};
Ext.extend(ImagePlus.panel.input, MODx.Panel, {


    /**
     * Bind change event on tv input DOM element so
     * that we can be notified when the user hits the
     * native 'Reset' button
     */
    listenForResetEvent: function () {
        var resourcePanel = Ext.getCmp('modx-panel-resource');
        resourcePanel.on('tv-reset', function (changed) {
            if (changed.id = this.imageplus.tv.id) {
                this.on_Reset();
            }
        }, this)
    },

    /**
     * Create the 'edit image' button
     */
    create_editButton: function () {

        this.editButton = new Ext.Button({
            text: _('imageplus.edit_image'), handler: this.editImage, scope: this, icon: ImagePlus.config.crop_icon, style: { marginRight: '5px' }
        })
    }//

    , create_clearButton: function () {
        this.clearButton = new Ext.Button({
            text: _('imageplus.clear_image') || "Clear Image", handler: this.clearImage, scope: this
        })
    }//

    /**
     * Create the image browser combo
     */, create_imageBrowser: function () {
        // Generate opento path
        var openToPath = this.imageplus.sourceImg.src.split('/');
        openToPath.pop();
        openToPath = openToPath.join('/');

        // Create browser component
        this.imageBrowser = new MODx.combo.Browser({
            value: this.imageplus.sourceImg.src, source: this.imageplus.mediaSource, hideSourceCombo: true, openTo: openToPath, listeners: {
                'select': {fn: this.on_imageSelected, scope: this}
            }
        })
    }

    /**
     * Create image preview img
     */, create_imagePreview: function () {
        this.imagePreview = new Ext.BoxComponent({autoEl: {tag: 'img', src: ''}});
    }

    /**
     * Create field for alt-text input
     */, create_altTextField: function () {
        this.altTextField = MODx.load({
            xtype: this.imageplus.altTagOn ? 'textfield' : 'hidden', value: this.imageplus.altTag || '', listeners: {
                'change': {fn: this.on_altTagChange, scope: this}
            }, width: 300, style: {marginBottom: '5px'}
        })
    }, generateThumbUrl: function (params) {
        var url = MODx.config.connectors_url + 'system/phpthumb.php?imageplus=1';
        var defaults = {
            wctx: 'mgr', f: 'png', q: 90, w: 150, source: this.imageplus.sourceImg.source
        }
        for (i in params) {
            defaults[i] = params[i]
        }
        for (i in defaults) {
            url += '&' + i + '=' + defaults[i];
        }
        return url;
    }

    /**
     * Fires when the TV field is reset
     */, on_Reset: function () {
        this.imageBrowser.setValue('');
        this.imageplus.sourceImg = false;
        this.editButton.disable();
        this.updatePreviewImage.defer(10, this);
    }

    /**
     * Render form elements to page
     */, on_Render: function () {
    }//

    /**
     * Runs after initial render of panel
     */, onAfterRender: function () {
        this.updateDisplay();
    }//

    /**
     * Fired when user has selected an image from the browser
     */, on_imageSelected: function (img) {

        var diffImg = (this.imageplus.sourceImg && this.imageplus.sourceImg.src != img.relativeUrl);


        this.oldSourceImg = {};
        for (i in this.imageplus.sourceImg) {
            this.oldSourceImg[i] = this.imageplus.sourceImg[i];
        }


        this.imageplus.sourceImg = {
            src: img.relativeUrl, width: img.image_width, height: img.image_height, source: this.imageplus.mediaSource
        }


        // Reset crop rectangle everytime an image is selected to be different from browser
        if (diffImg) {
            this.imageplus.crop.x = 0;
            this.imageplus.crop.y = 0;
            this.imageplus.crop.width = this.imageplus.targetWidth;
            this.imageplus.crop.height = this.imageplus.targetHeight;
        }


        // If server returns 800x600 or higher, image may be larger
        //  so need to get size manually
        if (img.image_width >= 800 || img.image_height >= 600) {
            this.manual_getImageSize();
        } else {
            // Update display
            this.updateDisplay();
            if (this.imageplus.crop.width == 0 || this.imageplus.crop.height == 0) this.editImage();
        }
        ;
    }//

    /**
     * Fired when alt-tag field is changed
     */, on_altTagChange: function (field, value) {
        this.imageplus.altTag = value;
        this.updateExternalField();
    }

    /**
     * Manually get image size
     * @return void
     */, manual_getImageSize: function () {
        var baseUrl = ImagePlus.config['sources'][this.imageplus.sourceImg.source].url;
        var img = new Image();
        img.onload = (function (ths) {
            return function () {
                ths.imageplus.sourceImg.width = this.width;
                ths.imageplus.sourceImg.height = this.height;

                ths.updateDisplay();
                if (ths.imageplus.crop.width == 0 || ths.imageplus.crop.height == 0)  ths.editImage();
            }
        })(this);
        img.src = baseUrl + this.imageplus.sourceImg.src;
    }//


    /**
     * Update the component display on state change
     */, updateDisplay: function () {

        // Make sure image is large enough to use
        if (!this.checkImageIsLargeEnough()) {

            this.imageplus.sourceImg = this.oldSourceImg;

            if (!this.oldSourceImg) this.imageBrowser.reset();
            else {
                if (this.oldSourceImg.crop) {
                    this.imageplus.crop.x = this.oldSourceImg.crop.x;
                    this.imageplus.crop.y = this.oldSourceImg.crop.y;
                    this.imageplus.crop.width = this.oldSourceImg.crop.width;
                    this.imageplus.crop.height = this.oldSourceImg.crop.height;
                }
                this.imageBrowser.setValue(this.lastFileLabel || "");
            }
            MODx.msg.alert("Image too small", "The selected image is too small to be used here. Please select a different image");
            return;
        }
        this.lastFileLabel = this.imageplus.sourceImg.src;

        // Hide 'edit' button if field is empty
        if (this.imageBrowser.getValue() == '') {
            this.editButton.disable();
            this.clearButton.hide();
        } else {
            this.editButton.enable();
            this.clearButton.show();
        }
        this.updatePreviewImage.defer(10, this);

        this.updateExternalField();
    }//


    /**
     * Update updateTo field input field value
     */, updateExternalField: function () {
        //  console.log(this.updateTo);


        var TV = {
            sourceImg: this.imageplus.sourceImg, crop: this.imageplus.crop, targetWidth: this.imageplus.targetWidth, targetHeight: this.imageplus.targetHeight, altTag: this.imageplus.altTag
        }
        var json = JSON.stringify(TV, null, '  ');


        var external = document.getElementById(this.updateTo);
        var current = external.value || '';
        if (current == '') {
            current = external.innerHTML
        }

        // Has value changed?
        if (current == json) {
            return
        }

        if (document.getElementById(this.updateTo)) {
            document.getElementById(this.updateTo).value = json;
//            document.getElementById(this.updateTo).innerHTML = json;
        }

        // Mark resource as dirty
        MODx.fireResourceFormChange()
    }


    /**
     * Checks whether the image is larger than specified crop dimensions
     * @returns bool
     */, checkImageIsLargeEnough: function () {
        if (!this.imageplus.sourceImg || this.imageplus == undefined) return true;

        if (this.imageplus.targetWidth > 0 && this.imageplus.sourceImg.width > 0) {
            if (this.imageplus.targetWidth > this.imageplus.sourceImg.width) {
                return false;
            }
        }
        if (this.imageplus.targetHeight > 0 && this.imageplus.sourceImg.height > 0) {
            if (this.imageplus.targetHeight > this.imageplus.sourceImg.height) {
                return false;
            }
        }
        return true;
    }


    /**
     * Launch the editor window
     */, editImage: function () {
        // Create the editor window (if it doesnt exist)
        if (!this.editorWindow) {

            // Calculate safe image ratio
            var imgW = this.imageplus.sourceImg.width;
            var imgH = this.imageplus.sourceImg.height;
            var maxH = window.innerHeight * 0.7;
            var maxW = window.innerWidth * 0.7;
            // Is image taller than screen?
            if (imgH > maxH) {
                var ratio = maxH / imgH
            } else if (imgW > maxW) {
                var ratio = maxW / imgW
            } else {
                var ratio = 1;
            }


            this.editorWindow = MODx.load({
                xtype: 'imageplus-window-editor', title: _('imageplus.editor_title'), imageplus: this.imageplus, inputPanel: this, displayRatio: ratio
                //    ,autoWidth: true
                , width: imgW * ratio, crop: this.imageplus.crop
            });

        }
        ;
        // Show the window
        this.editorWindow.show();
    }//
    , clearImage: function () {
        this.imageplus.sourceImg = null;
        this.oldSourceImg = null;
        this.lastFileLabel = "";
        this.editButton.disable();
        this.clearButton.hide();
        if (this.imagePreview.el) {
            jQuery(this.imagePreview.el.dom).attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
        }
        document.getElementById(this.updateTo).innerHTML = "";
        document.getElementById(this.updateTo).value = "";
        this.imageBrowser.setValue("");
        MODx.fireResourceFormChange();
    }

    /**
     * Receive new cropping dimensions from editor
     */, updateFromEditor: function (crop) {
        this.imageplus.crop.x = crop.x;
        this.imageplus.crop.y = crop.y;
        this.imageplus.crop.width = crop.width;
        this.imageplus.crop.height = crop.height;

        if (!this.oldSourceImg) {
            this.oldSourceImg = {};
            for (i in this.imageplus.sourceImg) {
                this.oldSourceImg[i] = this.imageplus.sourceImg[i];
            }
        }
        this.oldSourceImg.crop = {};
        this.oldSourceImg.crop.x = crop.x;
        this.oldSourceImg.crop.y = crop.y;
        this.oldSourceImg.crop.width = crop.width;
        this.oldSourceImg.crop.height = crop.height;


        this.editorWindow = null;
        this.updateDisplay();
    }, updatePreviewImage: function () {
        if (!this.imageplus.sourceImg || this.imageplus.crop.width == 0) {
            this.imagePreview.hide();
            return;
        }
        url = this.generateThumbUrl({
            src: this.imageplus.sourceImg.src, sw: this.imageplus.crop.width, sh: this.imageplus.crop.height, sx: this.imageplus.crop.x, sy: this.imageplus.crop.y
        })
        if (this.imagePreview.el) {
            this.imagePreview.el.dom.src = url;
            this.imagePreview.show()
        }
        ;
    }

});
Ext.reg('imageplus-panel-input', ImagePlus.panel.input);
