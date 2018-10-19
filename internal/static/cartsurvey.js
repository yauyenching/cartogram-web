function cartsurvey_init(a_u,t_u,d_u,s_u,sui_u,) {

    window.cartogram.scaling_factor = 1.7;

    window.cartsurvey = {

        anim_base_url: a_u,
        threemaps_base_url: t_u,
        data_base_url: d_u,
        surveys_base_url: s_u,
        surveys_ui_base_url: sui_u,
        program: null,
        enter_loading_state: function() {

            window.cartogram.enter_loading_state();

        },
        exit_loading_state: function() {

            window.cartogram.exit_loading_state();

        },
        http_get: function(url, timeout=15000) {

            return new Promise(function(resolve, reject){

                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if(this.readyState == 4)
                    {
                        if(this.status == 200)
                        {
                            try
                            {
                                resolve(JSON.parse(this.responseText));
                            }
                            catch(e)
                            {
                                console.log(e);
                                console.log(this.responseText);
                                reject('Unable to parse output.');
                            }
                        }
                        else
                        {
                            console.log(url);
                            reject('Unable to fetch data from the server.');
                        }
                    }
                };

                xhttp.ontimeout = function(e) {
                    reject('The request has timed out.');
                }

                xhttp.open("GET", url, true);
                xhttp.timeout = timeout;
                xhttp.send();

            });
        },
        load_survey: function(name) {

            if(window.cartogram.in_loading_state)
                return Promise.reject();
            
            return new Promise(function(resolve,reject){

                window.cartsurvey.enter_loading_state();

                window.cartsurvey.http_get(window.cartsurvey.surveys_base_url + "/" + name + "/program.json").then(function(program){

                    window.cartsurvey.program = program;
                    window.cartsurvey.program.name = name;

                    window.cartsurvey.exit_loading_state();
                    resolve();

                }, reject);

            });

        },
        interactivity_message: function(all_features, deactivations){

            var enabled_feautures = [];

            all_features.forEach(function(feature){

                if(!deactivations.includes(feature.name))
                    enabled_feautures.push(feature.description);

            });

            if(enabled_feautures.length == 0)
                return "You have access to no interactive features.";
            
            if(enabled_feautures.length == 1)
                return "You have access to the " + enabled_feautures[0] + " feature.";
            
            var msg = "You have access to the ";

            for(let i = 0; i < enabled_feautures.length; i++)
            {
                if(i == (enabled_feautures.length - 1))
                    msg += " and";
                
                msg += " " + enabled_feautures[i];

                if(i != (enabled_feautures.length - 1) && enabled_feautures.length != 2)
                    msg += ",";     
            }

            msg += " features.";

            return msg;

        },
        display_question: function(id) {

            if(window.cartogram.in_loading_state || this.program === null)
                return;
            
            var question = this.program.questions[id];

            if(question.hasOwnProperty("interactive"))
            {
                window.cartogram.enable_tooltip = !(question.interactive.deactivate.includes("tooltip"));
                window.cartogram.enable_highlight = !(question.interactive.deactivate.includes("highlight"));
                window.cartogram.animation_duration = question.interactive.deactivate.includes("animation") ? 0 : 1000;
            }
            else
            {
                /* We assume full interactivity */
                window.cartogram.enable_tooltip = true;
                window.cartogram.enable_highlight = true;
                window.cartogram.animation_duration = 1000;
            }
            
            if(question.type == "animation")
            {
                /* Redirect to the animation page. Specify the next URL if necessary */

                var animurl = this.anim_base_url + question.name + "?hrq=" + (id + 1);

                if(id < (this.program.questions.length - 1))
                {
                    animurl += "&next=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id + 1));
                }

                if(id != 0)
                {
                    animurl += "&prev=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id - 1));
                }

                if(question.hasOwnProperty("interactive"))
                {
                    animurl += "&deactivate=" + encodeURIComponent(question.interactive.deactivate.join(","));
                }

                window.location = animurl;
            }
            else if(question.type == "3maps")
            {
                /* Redirect to the 3maps page. Specify the next URL if necessary */

                var animurl = this.threemaps_base_url + "?hrq=" + (id + 1) + "&handler=" + question.map + "&maps=" + encodeURIComponent(window.btoa(JSON.stringify(question.maps)));

                if(id < (this.program.questions.length - 1))
                {
                    animurl += "&next=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id + 1));
                }

                if(id != 0)
                {
                    animurl += "&prev=" + encodeURIComponent(this.surveys_ui_base_url + this.program.name + "/" + (id - 1));
                }

                if(question.hasOwnProperty("interactive"))
                {
                    animurl += "&deactivate=" + encodeURIComponent(question.interactive.deactivate.join(","));
                }               

                window.location = animurl;
            }
            else if(question.type == "population")
            {
                if(question.hasOwnProperty('colors'))
                    window.cartogram.switch_cartogram_type(question.map, this.http_get(this.data_base_url + "/" + question.colors + ".json"));
                else
                    window.cartogram.switch_cartogram_type(question.map);
                
                document.getElementById('interactivity-message').innerText = this.interactivity_message([
                    {'name': 'tooltip', 'description': 'infotips'},
                    {'name': 'highlight', 'description': 'parallel highlighting'},
                    {'name': 'switching', 'description': 'map switching'}
                ], question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);
                
            }
            else if(question.type == "cartogram")
            {
                this.enter_loading_state();

                Promise.all([this.http_get(this.data_base_url + "/" + question.data + "_cartogramui.json"), this.http_get(this.data_base_url + "/" + question.data + "_cartogram.json"), window.cartogram.get_labels(question.map), window.cartogram.get_config(question.map)]).then(function(data){

                    window.cartogram.color_data = data[0].color_data;
                    window.cartogram.map_config = data[3];

                    window.cartogram.draw_three_maps(window.cartogram.get_pregenerated_map(question.map, "original"), data[1], window.cartogram.get_pregenerated_map(question.map, "population"), "map-area", "cartogram-area", "Land Area", data[0].tooltip.label, "Population",data[2]).then(function(v){

                        window.cartogram.tooltip_clear();
                        window.cartogram.tooltip_initialize();
                        window.cartogram.tooltip.push(v[0].tooltip);
                        window.cartogram.tooltip.push(v[2].tooltip);
                        window.cartogram.tooltip.push(data[0].tooltip);

                        window.cartogram.exit_loading_state();
                        document.getElementById('cartogram').style.display = 'block';

                        document.getElementById('interactivity-message').innerText = window.cartsurvey.interactivity_message([
                            {'name': 'tooltip', 'description': 'infotips'},
                            {'name': 'highlighting', 'description': 'parallel highlighting'},
                            {'name': 'switching', 'description': 'map switching'}
                        ], question.hasOwnProperty("interactive") ? question.interactive.deactivate : []);

                    }, function(e){
                        window.cartogram.do_fatal_error(e);
                    });

                }, function(e){
                    window.cartogram.do_fatal_error(e);
                });
            }
            else
            {
                window.cartogram.do_fatal_error("Unrecognized question type '" + question.type + "'.");
            }

            /* Update or hide the next and previous buttons */
            /* This may run before the current question is finished loading, but that's okay */

            if(id == (this.program.questions.length - 1))
            {
                document.getElementById('next-button').style.display = 'none';
            }
            else
            {
                document.getElementById('next-button').onclick = (function(i){

                    return function(e) {

                        //window.cartsurvey.display_question(i+1);
                        window.location = window.cartsurvey.surveys_ui_base_url + window.cartsurvey.program.name + "/" + (id + 1)

                    };

                }(id));
            }

            if(id == 0)
            {
                document.getElementById('prev-button').style.display = 'none';
            }
            else
            {
                document.getElementById('prev-button').onclick = (function(i){

                    return function(e) {

                        //window.cartsurvey.display_question(i-1);
                        window.location = window.cartsurvey.surveys_ui_base_url + window.cartsurvey.program.name + "/" + (id - 1)

                    };

                }(id));
            }

            document.getElementById('question-no').innerText = id + 1;


        }

    };

}