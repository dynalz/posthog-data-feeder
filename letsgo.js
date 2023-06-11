(function() {
    var debug = window.ph_attach_debug = {"analytics": {}, "attached": [], "run_details": {"ran": false}}
    function str_hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            let chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // convert to 32bit integer
        }
        // convert to base36 (numbers + letters)
        return (hash >>> 0).toString(36);
    }

    function value_is_null(value) {
        return !value || value == "" || value == "null"
    }

    function save_debug(key, value) {
        debug.analytics[key] = value
    }

    function save_data(key, value, input) {
        if (value_is_null(value))
            return
        
        // clean the key
        key = key.trim();
        key = key.replace(/[^\w\s]/gi, '');
        key = key.toLowerCase();
        if (key.length > 64)
            key = key.substring(0, 64);
        
        // if key is empty, use hash of input element as key
        if (key === '')
            key = 'input_' + str_hash(input.outerHTML);
        
        // if key contains 'email'
        if (key.includes('email')) {
            // Validate the input
            let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (emailRegex.test(value)) {
                posthog.identify(value);
                save_debug("email", value)
                return
            }
        }
        
        const data = {$set: {}}
        data.$set[key] = value
        posthog.capture('input-capture', data)
        save_debug(key, value)
    }

    function attachEvent(input) {
        debug.attached.push(input)

        function send_save(input) {
            let key = input.getAttribute('name');
            if (!key) {
                let label = document.querySelector(`label[for="${input.id}"]`);
                key = label ? label.innerText : input.getAttribute('placeholder');
            }
            let value = input.value;
            save_data(key, value, input);
        }

        if (input.type !== 'hidden' && !value_is_null(input.value))
            send_save(input)

        input.addEventListener('focusout', function () {
            send_save(this)
        });
        input.addEventListener('input', function () {
            if (document.activeElement !== this) {
                send_save(this)
            }
        });
    }

    function traverseNodes(node) {
        if (node.nodeName.toLowerCase() === 'input')
            attachEvent(node);
        if (node.shadowRoot)
            node.shadowRoot.childNodes.forEach(traverseNodes);
        node.childNodes.forEach(traverseNodes);
    }

    function attachAll() {
        if (!window.posthog) {
            debug.run_details.error = "Posthog not found"
            return
        }
        //if (window.run_details.ran) {
        //    console.log("Already attached")
        //    return
        //}
        
        debug.run_details.ran = true
        traverseNodes(document.body);

        // Observe for dynamically created inputs
        var observer = new MutationObserver((mutationsList, observer) => {
            for(let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        traverseNodes(node);
                    });
                }
            }
        });
        
        function observeAllShadowRoots(node) {
            if (node.shadowRoot) {
                observer.observe(node.shadowRoot, { childList: true, subtree: true });
                node.shadowRoot.childNodes.forEach(observeAllShadowRoots);
            }
            node.childNodes.forEach(observeAllShadowRoots);
        }
        // observe body changes
        observer.observe(document.body, { childList: true, subtree: true });
        // observe shadow-root changes
        observeAllShadowRoots(document.body, observer);
    }

    attachAll()
    window.addEventListener('DOMContentLoaded', attachAll);
})();