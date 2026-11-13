
self.addEventListener("push", (event) => {
    let data = {
        title: "QM PROFITER",
        body: "You have a new VIP notification.",
        url: "/vip-signals.html"
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (error) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            data: {
                url: data.url || "/vip-signals.html"
            },
            tag: "qm-profiter-vip",
            renotify: true
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data?.url || "/vip-signals.html",
        self.location.origin
    ).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin)) {
                    return client.focus().then(() => {
                        if (client.navigate) {
                            return client.navigate(targetUrl);
                        }
                    });
                }
            }

            return clients.openWindow(targetUrl);
        })
    );
});
