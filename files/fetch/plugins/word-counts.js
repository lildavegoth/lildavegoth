(function() {
    var plugin = {
        name: 'Word Count',
        description: 'Counts words in the current note.',
        version: '1.0',
        init: function(app) {
            app.registerToolbarButton({
                icon: '<i class="fas fa-calculator"></i>',
                tooltip: 'Word Count',
                action: function() {
                    var noteId = app.getCurrentNoteId();
                    if (!noteId) return;
                    var note = app.getNotes().find(function(n) { return n.id === noteId; });
                    if (!note) return;
                    var words = note.content.split(/\s+/).filter(Boolean).length;
                    window.showMessage('Word count: ' + words);
                }
            });
        }
    };

    if (window.NotesApp) {
        window.NotesApp.plugins.register(plugin);
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            window.NotesApp.plugins.register(plugin);
        });
    }
})();
