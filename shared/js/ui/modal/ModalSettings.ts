/// <reference path="../../utils/modal.ts" />
/// <reference path="../../utils/tab.ts" />
/// <reference path="../../proto.ts" />
/// <reference path="../../voice/AudioController.ts" />

namespace Modals {
    import info = log.info;
    import TranslationRepository = i18n.TranslationRepository;

    export function spawnSettingsModal() {
        let modal;
        modal = createModal({
            header: tr("Settings"),
            body: () => {
                let template = $("#tmpl_settings").renderTag();
                template = $.spawn("div").append(template);
                initialiseSettingListeners(modal,template = template.tabify());
                initialise_translations(template.find(".settings-translations"));
                return template;
            },
            footer: () => {
                let footer = $.spawn("div");
                footer.addClass("modal-button-group");
                footer.css("margin-top", "5px");
                footer.css("margin-bottom", "5px");
                footer.css("text-align", "right");

                let buttonOk = $.spawn("button");
                buttonOk.text(tr("Ok"));
                buttonOk.click(() => modal.close());
                footer.append(buttonOk);

                return footer;
            },
            width: 750
        });
        modal.open();
    }

    function initialiseSettingListeners(modal: Modal, tag: JQuery) {
        //Voice
        initialiseVoiceListeners(modal, tag.find(".settings_audio"));
    }

    function initialiseVoiceListeners(modal: Modal, tag: JQuery) {
        let currentVAD = settings.global("vad_type", "ppt");

        { //Initialized voice activation detection
            const vad_tag = tag.find(".settings-vad-container");

            vad_tag.find('input[type=radio]').on('change', event => {
                const select = event.currentTarget as HTMLSelectElement;
                {
                    vad_tag.find(".settings-vad-impl-entry").hide();
                    vad_tag.find(".setting-vad-" + select.value).show();
                }
                {
                    settings.changeGlobal("vad_type", select.value);
                    globalClient.voiceConnection.voiceRecorder.reinitialiseVAD();
                }

                switch (select.value) {
                    case "ppt":
                        let ppt_settings: PPTKeySettings = settings.global('vad_ppt_settings', undefined);
                        ppt_settings = ppt_settings ? JSON.parse(ppt_settings as any as string) : {};

                        vad_tag.find(".vat_ppt_key").text(ppt.key_description(ppt_settings));
                        break;
                    case "vad":
                        let slider = vad_tag.find(".vad_vad_slider");
                        let vad: VoiceActivityDetectorVAD = globalClient.voiceConnection.voiceRecorder.getVADHandler() as VoiceActivityDetectorVAD;
                        slider.val(vad.percentageThreshold);
                        slider.trigger("change");
                        globalClient.voiceConnection.voiceRecorder.update(true);
                        vad.percentage_listener = per => {
                            vad_tag.find(".vad_vad_bar_filler")
                                .css("width", per + "%");
                        };
                        break;
                }
            });

            { //Initialized push to talk
                vad_tag.find(".vat_ppt_key").click(function () {
                    let modal = createModal({
                        body: "",
                        header: () => {
                            let head = $.spawn("div");
                            head.text(tr("Type the key you wish"));
                            head.css("background-color", "blue");
                            return head;
                        },
                        footer: ""
                    });

                    let listener = (event: ppt.KeyEvent) => {
                        if(event.type == ppt.EventType.KEY_TYPED) {
                            settings.changeGlobal('vad_ppt_key', undefined); //TODO remove that because its legacy shit
                            console.log(tr("Got key %o"), event);

                            let ppt_settings: PPTKeySettings = settings.global('vad_ppt_settings', undefined);
                            ppt_settings = ppt_settings ? JSON.parse(ppt_settings as any as string) : {};
                            Object.assign(ppt_settings, event);
                            settings.changeGlobal('vad_ppt_settings', ppt_settings);

                            globalClient.voiceConnection.voiceRecorder.reinitialiseVAD();

                            ppt.unregister_key_listener(listener);
                            modal.close();
                            vad_tag.find(".vat_ppt_key").text(ppt.key_description(event));
                        }
                    };
                    ppt.register_key_listener(listener);
                    modal.open();
                });
            }

            { //Initialized voice activation detection
                let slider = vad_tag.find(".vad_vad_slider");
                slider.on("input change", () => {
                    settings.changeGlobal("vad_threshold", slider.val().toString());
                    let vad = globalClient.voiceConnection.voiceRecorder.getVADHandler();
                    if(vad instanceof  VoiceActivityDetectorVAD)
                        vad.percentageThreshold = slider.val() as number;
                    vad_tag.find(".vad_vad_slider_value").text(slider.val().toString());
                });
                modal.properties.registerCloseListener(() => {
                    let vad = globalClient.voiceConnection.voiceRecorder.getVADHandler();
                    if(vad instanceof  VoiceActivityDetectorVAD)
                        vad.percentage_listener = undefined;

                });
            }

            let target_tag = vad_tag.find('input[type=radio][name="vad_type"][value="' + currentVAD + '"]');
            if(target_tag.length == 0) {
                //TODO tr
                console.warn("Failed to find tag for " + currentVAD + ". Using latest tag!");
                target_tag = vad_tag.find('input[type=radio][name="vad_type"]').last();
            }
            target_tag.prop("checked", true);
            setTimeout(() => target_tag.trigger('change'), 0);
        }

        { //Initialize microphone

            const setting_tag = tag.find(".settings-microphone");
            const tag_select = setting_tag.find(".audio-select-microphone");
            console.log(setting_tag);
            console.log(setting_tag.find(".settings-device-error"));
            console.log(setting_tag.find(".settings-device-error").html());

            { //List devices
                $.spawn("option")
                    .attr("device-id", "")
                    .attr("device-group", "")
                    .text(tr("No device"))
                    .appendTo(tag_select);

                navigator.mediaDevices.enumerateDevices().then(devices => {
                    const active_device = globalClient.voiceConnection.voiceRecorder.device_id();

                    for(const device of devices) {
                        console.debug(tr("Got device %s (%s): %s"), device.deviceId, device.kind, device.label);
                        if(device.kind !== 'audioinput') continue;

                        $.spawn("option")
                            .attr("device-id", device.deviceId)
                            .attr("device-group", device.groupId)
                            .text(device.label)
                            .prop("selected", device.deviceId == active_device)
                            .appendTo(tag_select);
                    }
                }).catch(error => {
                    console.error(tr("Could not enumerate over devices!"));
                    console.error(error);
                    setting_tag.find(".settings-device-error")
                        .text(tr("Could not get device list!"))
                        .css("display", "block");
                });

                if(tag_select.find("option:selected").length == 0)
                    tag_select.find("option").prop("selected", true);

            }

            {
                tag_select.on('change', event => {
                    let selected_tag = tag_select.find("option:selected");
                    let deviceId = selected_tag.attr("device-id");
                    let groupId = selected_tag.attr("device-group");
                    console.log(tr("Selected microphone device: id: %o group: %o"), deviceId, groupId);
                    globalClient.voiceConnection.voiceRecorder.change_device(deviceId, groupId);
                });
            }
        }

        { //Initialize speaker
            const setting_tag = tag.find(".settings-speaker");
            const tag_select = setting_tag.find(".audio-select-speaker");
            const active_device = audio.player.current_device();

            audio.player.available_devices().then(devices => {
                for(const device of devices) {
                    $.spawn("option")
                        .attr("device-id", device.device_id)
                        .text(device.name)
                        .prop("selected", device.device_id == active_device.device_id)
                        .appendTo(tag_select);
                }
            }).catch(error => {
                console.error(tr("Could not enumerate over devices!"));
                console.error(error);
                setting_tag.find(".settings-device-error")
                    .text(tr("Could not get device list!"))
                    .css("display", "block");
            });


            if(tag_select.find("option:selected").length == 0)
                tag_select.find("option").prop("selected", true);

            {
                const error_tag = setting_tag.find(".settings-device-error");
                tag_select.on('change', event => {
                    let selected_tag = tag_select.find("option:selected");
                    let deviceId = selected_tag.attr("device-id");
                    console.log(tr("Selected speaker device: id: %o"), deviceId);
                    audio.player.set_device(deviceId).then(() => error_tag.css("display", "none")).catch(error => {
                        console.error(error);
                        error_tag
                            .text(tr("Failed to change device!"))
                            .css("display", "block");
                    });
                });
            }
        }

        //Initialise microphones
        /*
        let select_microphone = tag.find(".voice_microphone_select");
        let select_error = tag.find(".voice_microphone_select_error");

        navigator.mediaDevices.enumerateDevices().then(devices => {
            let recoder = globalClient.voiceConnection.voiceRecorder;

            console.log("Got " + devices.length + " devices:");
            for(let device of devices) {
                console.log(" - Type: %s Name %s ID: %s Group: %s", device.kind, device.label, device.deviceId, device.groupId);
                if(device.kind == "audioinput") {
                    let dtag = $.spawn("option");
                    dtag.attr("device-id", device.deviceId);
                    dtag.attr("device-group", device.groupId);
                    dtag.text(device.label);
                    select_microphone.append(dtag);

                    if(recoder) dtag.prop("selected", device.deviceId == recoder.device_id());
                }
            }
        }).catch(error => {
            console.error("Could not enumerate over devices!");
            console.error(error);
            select_error.text("Could not get device list!").show();
        });

        select_microphone.change(event => {
            let deviceSelected = select_microphone.find("option:selected");
            let deviceId = deviceSelected.attr("device-id");
            let groupId = deviceSelected.attr("device-group");
            console.log("Selected microphone device: id: %o group: %o", deviceId, groupId);
            globalClient.voiceConnection.voiceRecorder.change_device(deviceId, groupId);
        });
        */
        //Initialise speakers

   }

   function initialise_translations(tag: JQuery) {
       { //Initialize the list
           const tag_list = tag.find(".setting-list .list");
           const tag_loading = tag.find(".setting-list .loading");
           const template = $("#settings-translations-list-entry");
           const restart_hint = tag.find(".setting-list .restart-note");
           restart_hint.hide();

           const update_list = () => {
               tag_list.empty();

               const currently_selected = i18n.config.translation_config().current_translation_url;
               { //Default translation
                   const tag = template.renderTag({
                       type: "default",
                       selected: !currently_selected || currently_selected == "default"
                   });
                   tag.on('click', () => {
                       i18n.select_translation(undefined, undefined);
                       tag_list.find(".selected").removeClass("selected");
                       tag.addClass("selected");

                       restart_hint.show();
                   });
                   tag.appendTo(tag_list);
               }

               {
                    const display_repository_info = (repository: TranslationRepository) => {
                        const info_modal = createModal({
                            header: tr("Repository info"),
                            body: () => {
                                return $("#settings-translations-list-entry-info").renderTag({
                                    type: "repository",
                                    name: repository.name,
                                    url: repository.url,
                                    contact: repository.contact,
                                    translations: repository.translations || []
                                });
                            },
                            footer: () => {
                                let footer = $.spawn("div");
                                footer.addClass("modal-button-group");
                                footer.css("margin-top", "5px");
                                footer.css("margin-bottom", "5px");
                                footer.css("text-align", "right");

                                let buttonOk = $.spawn("button");
                                buttonOk.text(tr("Close"));
                                buttonOk.click(() => info_modal.close());
                                footer.append(buttonOk);

                                return footer;
                            }
                        });
                        info_modal.open()
                    };

                   tag_loading.show();
                   i18n.iterate_translations((repo, entry) => {
                       let repo_tag = tag_list.find("[repository=\"" + repo.unique_id + "\"]");
                       if(repo_tag.length == 0) {
                           repo_tag = template.renderTag({
                               type: "repository",
                               name: repo.name || repo.url,
                               id: repo.unique_id
                           });

                           repo_tag.find(".button-delete").on('click', e => {
                               e.preventDefault();

                               Modals.spawnYesNo(tr("Are you sure?"), tr("Do you really want to delete this repository?"), answer => {
                                    if(answer) {
                                        i18n.delete_repository(repo);
                                        update_list();
                                    }
                               });
                           });
                           repo_tag.find(".button-info").on('click', e => {
                               e.preventDefault();

                               display_repository_info(repo);
                           });

                           tag_list.append(repo_tag);
                       }

                       const tag = template.renderTag({
                           type: "translation",
                           name: entry.info.name || entry.url,
                           id: repo.unique_id,
                           selected: i18n.config.translation_config().current_translation_url == entry.url
                       });
                       tag.find(".button-info").on('click', e => {
                           e.preventDefault();

                           const info_modal = createModal({
                               header: tr("Translation info"),
                               body: () => {
                                   const tag = $("#settings-translations-list-entry-info").renderTag({
                                       type: "translation",
                                       name: entry.info.name,
                                       url: entry.url,
                                       repository_name: repo.name,
                                       contributors: entry.info.contributors || []
                                   });

                                   tag.find(".button-info").on('click', () => display_repository_info(repo));

                                   return tag;
                               },
                               footer: () => {
                                   let footer = $.spawn("div");
                                   footer.addClass("modal-button-group");
                                   footer.css("margin-top", "5px");
                                   footer.css("margin-bottom", "5px");
                                   footer.css("text-align", "right");

                                   let buttonOk = $.spawn("button");
                                   buttonOk.text(tr("Close"));
                                   buttonOk.click(() => info_modal.close());
                                   footer.append(buttonOk);

                                   return footer;
                               }
                           });
                           info_modal.open()
                       });
                       tag.on('click', e => {
                            if(e.isDefaultPrevented()) return;
                            i18n.select_translation(repo, entry);
                            tag_list.find(".selected").removeClass("selected");
                            tag.addClass("selected");

                           restart_hint.show();
                       });
                       tag.insertAfter(repo_tag)
                   }, () => {
                       tag_loading.hide();
                   });
               }

           };

           {
               tag.find(".button-add-repository").on('click', () => {
                   createInputModal("Enter URL", tr("Enter repository URL:<br>"), text => true, url => { //FIXME test valid url
                       if(!url) return;

                       tag_loading.show();
                       i18n.load_repository(url as string).then(repository => {
                           i18n.register_repository(repository);
                           update_list();
                       }).catch(error => {
                           tag_loading.hide();
                           createErrorModal("Failed to load repository", tr("Failed to query repository.<br>Ensure that this repository is valid and reachable.<br>Error: ") + error).open();
                       })
                   }).open();
               });
           }

           restart_hint.find(".button-reload").on('click', () => {
               location.reload();
           });

           update_list();
       }
   }
}