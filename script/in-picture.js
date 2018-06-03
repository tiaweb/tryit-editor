(function (w, d, undefined) {
    console.log(123);
    var adbro = w['adbro'],
        config = adbro.config || {};

    config.endpoint = '//api.adbro.me/api/v1/';
    if (w.location.protocol == 'https:') {
        config.endpoint = '//apis.adbro.me/api/v1/';
    }
    config.debug = config.debug || false;
    config.dryrun = config.dryrun || false;

    // Adding default configuration parameters if does not exist.
    config.selectors = config.selectors || {};
    config.selectors.images = config.selectors.images || 'img[data-adbro=true]';
    config.selectors.title = config.selectors.title || 'h1';

    // Setting default extension functions:
    config.functions = config.functions || {};
    config.functions.onLoad = config.functions.onLoad || function () { };
    config.functions.onPlaceholderSized = config.functions.onPlaceholderSized || function () { };
    config.functions.onInventoryHit = config.functions.onInventoryHit || function () { };
    config.functions.onInventoryImpression = config.functions.onInventoryImpression || function (img, div, data) { };
    config.functions.onAdvertisementClose = config.functions.onAdvertisementClose || function (div) { };
    config.functions.getImages = config.functions.getImages || function () {
        // TODO: Ask thanhnien.vn to update their code:
        if (w.location.href.indexOf('thanhnien.vn') > -1) {
            return d.querySelectorAll('#contentAvatar img.storyavatar');
        }
        // TODO: Included with https://gist.github.com/ashvetsov/9cfa5588ed4a42c844d74e1c035bfbf3:
        if (w.location.href.indexOf('tienphong.vn') > -1) {
            var img = document.querySelector('#article-body .photo > img');
            if (img) {
                return [img];
            } else {
                return [];
            }
        }
        // TODO: Baodatviet and some others processess too much images on page:
        // Need to fix https://gist.github.com/ashvetsov/9c4ae1752265d24e5f3cb478ba4b0fac
        // and https://gist.github.com/ashvetsov/654fe3795344e6f1a6ce7e0b8f9270b2
        // In common, if we use non-default selector, we take first image only:
        if (config.selectors.images != 'img[data-adbro=true]') {
            var img = d.querySelector(config.selectors.images);
            if (img) {
                return [img];
            } else {
                return [];
            }
        }

        return d.querySelectorAll(config.selectors.images);
    }
    config.functions.getImageUrl = config.functions.getImageUrl || function (img) {
        return img.src;
    }
    config.functions.getSatellitePlaceholder = config.functions.getSatellitePlaceholder || function (div) {
        return d.createElement('div');
    }

    /*
     * Helper functions:
     */
    function getAdvertisementFor(imageUrl, callback, onerror) {
        var callbackName = 'adbrocb' + Math.floor(Math.random() * 1000001),
            requestUri = config.endpoint +
                'advertising/publisher/' + adbro.publisher +
                (!config.dryrun ? '/advertisement/' : '/hit/') +
                '?imageUrl=' + encodeURIComponent(imageUrl) +
                '&pageUrl=' + encodeURIComponent(w.location.href) +
                '&callback=' + callbackName;
        callbackName = 'simple_ad';
        requestUri = 'https://static-org.hadarone.com/demo/in-picture/simple_ad.js';

        (function (w, d, o, u, e) {
            a = d.createElement(o), m = d.getElementsByTagName(o)[0];
            a.async = 1;
            a.src = u;
            a.onerror = e;
            m.parentNode.insertBefore(a, m);
        })
            (window, document, 'script', requestUri, onerror);
        w[callbackName] = function (data) {
            callback(data);
            delete w[callbackName];
        };
    }

    function createPlaceholder(img) {
        var div = d.createElement('div');
        if (config.debug) div.style.border = '1px solid green';
        div.style.position = 'relative';
        div.style.display = 'none';
        img.parentNode.insertBefore(div, img.nextSibling);
        return div;
    }

    function sizePlaceholder(div, img) {
        div.style.display = 'inline-block';
        div.style.overflow = 'hidden';
        // Setting div sizes and position:
        div.style.width = img.offsetWidth + 'px';
        div.style.height = img.offsetHeight + 'px';
        div.style.top = '-' + img.offsetHeight + 'px';
        div.style.marginBottom = '-' + (img.offsetHeight - 15) + 'px';
        // Setting size-related classes:
        if (img.offsetWidth < 600) div.classList.add('adbro-sm');
        else if (img.offsetWidth < 800) div.classList.add('adbro-md');
        else if (img.offsetWidth >= 800) div.classList.add('adbro-lg');
        // Calling post-processing function:
        config.functions.onPlaceholderSized(div, img);
    }

    function renderAdvertisement(div, data) {
        // Removing placeholder if no ads available to show,
        // except when debug mode is enabled:
        if (data.length == 0) {
            if (!config.debug) div.remove();
            return;
        }
        div.innerHTML = data[0].html;
        // Preparing payload data:
        var payload = data[0].payload;
        if (payload != null) {
            // 1. Calculating ratio
            var ratioX = payload.metadata.Width / div.offsetWidth,
                ratioY = payload.metadata.Height / div.offsetHeight;
            // 2. Updating faces coordinates
            if (ratioX != 1 || ratioY != 1) {
                [].forEach.call(payload.faces, function (face) {
                    var rect = face.FaceRectangle;
                    rect.Top = Math.round(rect.Top / ratioY);
                    rect.Left = Math.round(rect.Left / ratioX);
                    rect.Height = Math.round(rect.Height / ratioY);
                    rect.Width = Math.round(rect.Width / ratioX);
                });
            }
        }

        // Creating satellite block:
        var scontent = div.querySelector('.adbro-satellite'),
            satellite = null;
        if (scontent != null) {
            satellite = config.functions.getSatellitePlaceholder(div);
            satellite.innerHTML = scontent.outerHTML;
            scontent.remove();
        }

        function closeAdvertisement() {
            config.functions.onAdvertisementClose(div);
            if (satellite != null) satellite.remove();
            div.remove();
        }

        function processLinksAndScripts(block) {
            // Searching for close button and handling close action:
            var close = block.querySelector('.hd1_in_image__close');
            if (close != null) {
                close.onclick = closeAdvertisement;
            }

            // Setting clicks tracking for data-track links:
            [].forEach.call(block.querySelectorAll('a'), function (el) {
                var track_url = el.getAttribute('data-track-url');
                el.addEventListener('click', function (e) {
                    if (track_url) {
                        e.preventDefault();
                        if (el.getAttribute('target') == '_blank') {
                            window.open(track_url);
                        } else {
                            window.location.href = track_url;
                        }
                    }
                }, false);
            });

            // Searching for script and executing it:
            var js = block.querySelector('script');
            if (js != null) {
                // TODO: This <br> replacement is a temporary need.
                js = js.innerHTML.replace(/<br>/g, '');
                eval('(function (payload) {' + js + '})').call(block, payload);
            }
        }

        processLinksAndScripts(div);
        if (satellite != null) {
            processLinksAndScripts(satellite);
        }
    }

    function init() {
        console.log(1234)
        var title = d.querySelector(config.selectors.title),
            images = config.functions.getImages();
        title = title == null ? '' : title.innerText;
        console.log(config, images);
        [].forEach.call(images, function (img) {
            console.log(12222);
            // Getting image URL and creating placeholder if URL
            // successfully extracted:
            var imageUrl = config.functions.getImageUrl(img);
            if (imageUrl.indexOf('mr-pine-1100424.jpg') > -1) return;

            // TODO: Some publishers may have data-based images.
            if (imageUrl.indexOf('data:image') == 0) return;

            if (!imageUrl) return;
            var placeholder = createPlaceholder(img);
            getAdvertisementFor(imageUrl, function (data) {
                console.log('Advertisement data for:', imageUrl);
                console.log(data);
                renderAdvertisement(placeholder, data);
                // Calling custom Impression events handler:
                if (data != undefined && data.length > 0) {
                    config.functions.onInventoryImpression(img, placeholder, data);
                }
            }, function () {
                console.log('Error when getting advertisement data for:', imageUrl);
                if (!config.debug) placeholder.remove();
            });
            if (img.offsetHeight > 100) {
                sizePlaceholder(placeholder, img);

                if (imageUrl.indexOf('yan.vn') > 0) {
                    var oldHeight = img.offsetHeight;
                    setInterval(function () {
                        if (img.offsetHeight == oldHeight) return;
                        oldHeight = img.offsetHeight;
                        sizePlaceholder(placeholder, img);
                    }, 100);
                }
            } else {
                img.onload = function () {
                    sizePlaceholder(placeholder, img);
                };
            }
            var oldWidth = document.body.clientWidth;
            document.body.onresize = function () {
                if (document.body.clientWidth == oldWidth) return;
                oldWidth = document.body.clientWidth;
                sizePlaceholder(placeholder, img);
            };
            // Forcing image to send onload event (in case of caching):
            img.src = img.src;
            // Calling custom Hit events handler:
            config.functions.onInventoryHit(img);
        });
    }
    // init();
    setTimeout(init, 1000)
})(window, document);