(function() {
    // Polyfill for requestAnimationFrame and AudioContext
    window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
        return setTimeout(callback, 1000 / 60);
    };
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;

    // Set up helper functions for element selection and animation effects
    try {
        var e = document.querySelector.bind(document),
            t = document.querySelectorAll.bind(document),
            n = document.addEventListener.bind(document);
        Element.prototype.get = Element.prototype.querySelector;
        Element.prototype.show = function() {
            this.classList.remove("hidden");
        };
        Element.prototype.hide = function() {
            this.classList.add("hidden");
        };
        Element.prototype.fadeIn = function() {
            this.show();
            this.classList.add("fade");
            this.classList.remove("left");
            this.classList.remove("right");
        };
        Element.prototype.fadeOut = function() {
            this.classList.remove("fade");
        };
        Element.prototype.left = function() {
            this.classList.add("left");
        };
        Element.prototype.right = function() {
            this.classList.add("right");
        };
    } catch (err) {}

    // Polyfill for Date.now and performance.now
    Date.now = Date.now || function() { return (new Date).getTime(); };
    if (!("performance" in window)) {
        window.performance = {};
    }
    if (!("now" in window.performance)) {
        var o = Date.now();
        if (performance.timing && performance.timing.navigationStart) {
            o = performance.timing.navigationStart;
        }
        window.performance.now = function() { return Date.now() - o; };
    }
    var zoom = 0.1;
    // Global variables and constants
    var i = {},
        r = {},
        u,        // Canvas element
        a,        // WebGL context
        s = {},   // Audio buffers
        f,        // Audio context
        c,        // Start time for the animation
        l = window.devicePixelRatio || 1,
        d = false,          // Animation active flag
        m = "none",
        h = 0,
        w = 120,             // *** Timer duration updated to 60 seconds (was 30) ***
        p = 120,
        g,                  // Timer counter (will be set to w)
        x,                  // Timer timeout handler
        T = "attribute vec3 p; uniform float zoom;void main(void){gl_Position=vec4(p,zoom);}",
        b = "precision highp float;uniform vec2 resolution;uniform float time;uniform float scale;void main(void){vec2 p=abs(gl_FragCoord.xy-resolution/2.0);float f=time*scale;float n=(p.x+p.y)/2.0+mix(f,-f,step(length(resolution)/5.5,length(p)));gl_FragColor=vec4(vec3(sin(n/5.0/scale)*8.0),1.0);}";

    // Compiles a shader of a given type from source
    function v(source, type) {
        var shader = a.createShader(type);
        a.shaderSource(shader, source);
        a.compileShader(shader);
        if (!a.getShaderParameter(shader, a.COMPILE_STATUS)) {
            return null;
        }
        return shader;
    }

    // Initialize WebGL context and shaders
    function A() {
        if (!window.WebGLRenderingContext) {
            return false;
        }
        try {
            var options = { alpha: false, premultipliedAlpha: false };
            a = u.getContext("webgl", options) || u.getContext("experimental-webgl", options);
        } catch (err) {
            a = null;
        }
        if (!a) {
            return false;
        }
        a.uniforms = { resolution: {}, time: 0, scale: 1, fade: 1 };
        a.buffer = a.createBuffer();
        a.bindBuffer(a.ARRAY_BUFFER, a.buffer);
        a.bufferData(a.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), a.STATIC_DRAW);
        var program = a.createProgram(),
            vertexShader = v(T, a.VERTEX_SHADER),
            fragmentShader = v(b, a.FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) {
            return false;
        }
        a.attachShader(program, vertexShader);
        a.attachShader(program, fragmentShader);
        a.deleteShader(vertexShader);
        a.deleteShader(fragmentShader);
        a.linkProgram(program);
        if (!a.getProgramParameter(program, a.LINK_STATUS)) {
            return false;
        }
        a.program = program;
        return !!a;
    }

    // Fullscreen functions
    function B() {
        var t = document.body;
        try {
            if (t.requestFullscreen) {
                t.requestFullscreen();
            } else if (t.webkitRequestFullscreen) {
                t.webkitRequestFullscreen();
            } else if (t.webkitRequestFullScreen) {
                t.webkitRequestFullScreen();
            } else if (t.mozRequestFullScreen) {
                t.mozRequestFullScreen();
            }
        } catch (err) {}
    }
    function F() {
        if (document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen) {
            document.exitFullscreen();
        }
    }

    // Audio preloading and playing functions
    function S(name) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/assets/audio/" + name + ".mp3", true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function() {
            f.decodeAudioData(xhr.response, function(buffer) {
                s[name] = buffer;
            }, function() {});
        };
        xhr.send();
    }
    function R(name) {
        if (!s[name]) {
            return;
        }
        if (f && f.resume) {
            f.resume();
        }
        var source = f.createBufferSource();
        source.buffer = s[name];
        source.connect(f.destination);
        if (source.start) {
            source.start(0);
        } else {
            source.noteOn(0);
        }
    }

    // Update canvas size and WebGL viewport
    function y() {
        u.width = innerWidth * l;
        u.height = innerHeight * l;
        a.uniforms.resolution.width = u.width;
        a.uniforms.resolution.height = u.height;
        a.uniforms.scale = Math.sqrt(innerWidth * innerHeight) > 880 ? 1 : 0.6;
        a.viewport(0, 0, u.width, u.height);
    }

    // Monitor frame rate drops and adjust pixel ratio if needed
    function I() {
        r.rate = 1000 / (performance.now() - r.now);
        r.now = performance.now();
        if (r.drop < r.dropMax && r.rate < r.rateMin) {
            r.drop++;
            if (r.drop >= r.dropMax) {
                l = window.devicePixelRatio > 1 ? 1 : 0.5;
                y();
            }
        }
    }

    // Animation loop: updates uniforms and draws the scene
    function L() {
        if (!d || !a.program) {
            return;
        }
        requestAnimationFrame(L);
        I();
        a.uniforms.time = ((performance.now() - c) / 1000) * p;
        if (a.uniforms.fade > 0) {
            a.uniforms.fade -= 0.05;
        } else {
            a.uniforms.fade = 0;
        }
        a.useProgram(a.program);
        a.uniform2f(a.getUniformLocation(a.program, "resolution"), a.uniforms.resolution.width, a.uniforms.resolution.height);
        a.uniform1f(a.getUniformLocation(a.program, "time"), (a.uniforms.time * 3.0));
        a.uniform1f(a.getUniformLocation(a.program, "scale"), a.uniforms.scale * l);
        a.uniform1f(a.getUniformLocation(a.program, "zoom"), zoom);
        let speedSlider = 1.0;
        // a.uniform1f(a.getUniformLocation(a.program, "speedSlider"), speedSlider);
        a.bindBuffer(a.ARRAY_BUFFER, a.buffer);
        a.vertexAttribPointer(0, 2, a.FLOAT, false, 0, 0);
        a.enableVertexAttribArray(0);
        a.drawArrays(a.TRIANGLES, 0, 6);
        a.disableVertexAttribArray(0);
    }

    // Countdown timer function (now set to 60 seconds)
    function E() {
        if (g > 0) {
            i.timer.innerText = g;
            g--;
            if (g < 3) {
                R("high");
            } else if (g < 9) {
                R("low");
            }
            x = setTimeout(E, 1000);
        } else {
            R("high");
            _();
        }
    }

    // Utility function for setTimeout delays
    function O(delay, callback) {
        return setTimeout(callback, delay);
    }

    // Intro animation sequence
    function q() {
        i.section.webGLAlt.hide();
        i.section.intro.show();
        i.introButton.hide();
        i.introText[0].left();
        i.introText[1].right();
        O(200, function() {
            i.introTitle.fadeIn();
            i.introTitleStripes.fadeIn();
            O(1000, function() {
                i.introText[0].fadeIn();
                O(1500, function() {
                    i.introText[1].fadeIn();
                    i.introButton.fadeIn();
                });
            });
        });
    }

    // Transition from intro to instructions
    function C() {
        i.introText[0].fadeOut();
        i.introText[1].fadeOut();
        i.introTitle.fadeOut();
        i.introButton.fadeOut();
        var adElement = e(".ad");
        if (adElement) {
            adElement.hide();
        }
        document.title = document.title.split(" - ")[0] || document.title;
        R("low");
        O(400, k);
    }
    function k() {
        i.section.intro.hide();
        i.section.outro.hide();
        i.section.instructions.show();
        i.instructionsText[0].left();
        i.instructionsText[1].right();
        i.instructionsButton.hide();
        O(50, function() {
            i.instructionsText[0].fadeIn();
            O(200, function() {
                i.instructionsText[1].fadeIn();
                O(300, function() {
                    i.instructionsButton.fadeIn();
                    i.instructionsWarning.fadeIn();
                });
            });
        });
    }

    // Transition from instructions to active strobe effect
    function D() {
        i.instructionsText[0].fadeOut();
        i.instructionsText[1].fadeOut();
        i.instructionsButton.fadeOut();
        i.instructionsWarning.fadeOut();
        u.show();
        R("low");
        O(400, P);
    }
    function P() {
        if (innerWidth / screen.width < 0.4) {
            B();
        }
        O(50, function() {
            d = true;
            i.section.instructions.hide();
            g = w; // Timer now starts at 60 seconds
            E();
            i.timer.show();
            c = performance.now();
            L();
            u.fadeIn();
        });
    }

    // Stops the strobe effect when conditions are met
    function _(forceStop) {
        if (d && (g < w - 2 || forceStop)) {
            d = false;
            F();
            u.hide();
            u.fadeOut();
            clearTimeout(x);
            i.timer.innerText = "";
            i.timer.hide();
            i.section.outro.show();
            i.outroTitle.fadeIn();
            i.outroTitle.classList.add("down");
            i.repeatButton.hide();
            i.shareButton.hide();
            if (i.appButton) {
                i.appButton.hide();
            }
            O(g > w / 2 ? 500 : 2000, function() {
                i.outroTitle.classList.remove("down");
                i.outroText[0].left();
                if (i.outroText[1]) {
                    i.outroText[1].right();
                }
                O(500, function() {
                    i.outroText[0].fadeIn();
                    if (i.outroText[1]) {
                        i.outroText[1].fadeIn();
                    }
                    i.repeatButton.fadeIn();
                    i.shareButton.fadeIn();
                    if (i.appButton) {
                        i.appButton.fadeIn();
                    }
                });
            });
        }
    }

    // Repeat the strobe effect cycle
    function M() {
        h++;
        i.outroTitle.fadeOut();
        i.outroText[0].fadeOut();
        i.repeatButton.fadeOut();
        i.shareButton.fadeOut();
        if (i.appButton) {
            i.appButton.fadeOut();
        }
        if (i.outroText[1]) {
            i.outroText[1].fadeOut();
        }
        R("low");
        O(400, k);
    }

    // Share button handler using Web Share API or fallback window
    function U() {
        var url = this.dataset && this.dataset.url ? this.dataset.url : "",
            text = this.dataset && this.dataset.text ? this.dataset.text : "";
        if (navigator.share && window.Promise) {
            navigator.share({
                title: "Strobe Illusion",
                text: text,
                url: url
            }).then(function() {}).catch(function() {});
        } else {
            var width = 600,
                height = 340,
                left = screenX + (innerWidth - width) / 2,
                top = screenY + (innerHeight - height) / 2;
            window.open("https://neave.com/share/?url=" + encodeURIComponent(url) + "&text=" + text, "strobe-share", "resizable=yes,toolbar=no,scrollbars=yes,status=no,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top);
        }
    }

    // Main initialization function when DOM content is loaded
    function W() {
        u = e(".strobe");
        u.oncontextmenu = function(ev) {
            ev.preventDefault();
        };
        i = {
            section: {
                webGLAlt: e(".alt.webgl"),
                intro: e(".intro"),
                instructions: e(".instructions"),
                outro: e(".outro")
            },
            introTitle: e(".intro h1"),
            introTitleStripes: e(".intro h1 .stripes"),
            introText: t(".intro > p"),
            introButton: e(".intro .button"),
            instructionsButton: e(".instructions .button"),
            instructionsText: t(".instructions > p"),
            instructionsWarning: e(".instructions .warning"),
            outroTitle: e(".outro h2"),
            outroText: t(".outro > p"),
            repeatButton: e(".outro .button.repeat"),
            shareButton: e(".outro .button.share"),
            appButton: e(".outro .button.app"),
            timer: e(".timer")
        };
        if (A()) {
            r = {
                rate: 0,
                now: 0,
                drop: 0,
                dropMax: 10,
                rateMin: 40
            };
            y();
            window.onresize = y;
            i.introButton.onclick = C;
            i.instructionsButton.onclick = D;
            window.onblur = u.onmouseleave = _;
            u.onmousedown = function() {
                _();
            };
            i.repeatButton.onclick = M;
            i.shareButton.onclick = U;
            n("visibilitychange", function() {
                if (document.hidden) {
                    _();
                }
            });
            if (window.AudioContext) {
                f = new AudioContext();
                S("low");
                S("high");
            }
            q();
        } else {
            try {
                i.section.webGLAlt.show();
                O(250, function() {
                    e(".alt.webgl h1").fadeIn();
                });
            } catch (err) {}
        }
    }
    n("DOMContentLoaded", W, false);
})();