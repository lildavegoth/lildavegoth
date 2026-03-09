(function() {
    window.saveToDownloads = function(data, filename, mimeType = 'application/octet-stream') {
        if (!window.cordova) {
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return;
        }
        document.addEventListener('deviceready', function() {
            cordova.plugins.permissions.requestPermission(
                cordova.plugins.permissions.WRITE_EXTERNAL_STORAGE,
                function(status) {
                    if (!status.hasPermission) {
                        alert('Storage permission is required to save files.');
                        return;
                    }
                    saveToDownloadsCordova(data, filename, mimeType);
                },
                function() {
                    alert('Failed to request storage permission.');
                }
            );
        });
    };

    function saveToDownloadsCordova(data, filename, mimeType) {
        window.resolveLocalFileSystemURL(
            cordova.file.externalRootDirectory + 'Download/',
            function(dir) {
                dir.getFile(filename, { create: true, exclusive: false }, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = function() {
                            alert('File saved to Downloads: ' + filename);
                            if (window.cordova.plugins && window.cordova.plugins.fileOpener2) {
                                cordova.plugins.fileOpener2.open(
                                    fileEntry.nativeURL,
                                    mimeType,
                                    {
                                        error: function(e) {
                                            console.error('Error opening file', e);
                                            alert('File saved but could not open automatically.');
                                        },
                                        success: function() {
                                            console.log('File opened successfully');
                                        }
                                    }
                                );
                            }
                        };
                        writer.onerror = function() {
                            alert('Error writing file.');
                        };
                        writer.write(new Blob([data], { type: mimeType }));
                    }, function() {
                        alert('Could not create file writer.');
                    });
                }, function() {
                    alert('Could not create file: ' + filename);
                });
            },
            function() {
                window.resolveLocalFileSystemURL(
                    cordova.file.dataDirectory,
                    function(dir) {
                        dir.getFile(filename, { create: true }, function(fileEntry) {
                            fileEntry.createWriter(function(writer) {
                                writer.onwriteend = function() {
                                    alert('File saved to app folder (Downloads not accessible).');
                                };
                                writer.onerror = function() {
                                    alert('Error writing file.');
                                };
                                writer.write(new Blob([data], { type: mimeType }));
                            });
                        });
                    },
                    function() {
                        alert('Cannot access any storage location.');
                    }
                );
            }
        );
    }
})();