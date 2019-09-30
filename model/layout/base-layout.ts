/*
- modelChange(ModelChangeLog):
    type(string): null
    rowId(integer): null
    field(string): null
    at(datetime): now

    ~- notifyRequest(ModelChangeNotifyRequest):
      at(datetime): now
      name(string): null

- SchemaHistory:
    modelLayout(text): null
    layoutToSchemaVersion(string): null
    at(datetime): now

- app(App):
    name(string): null
    cookiePrefix(string):
      default: "noboapp"

    ~< users(User):
      phoenixKey(string): null

    # A template is some DOM block that can be customised with a model (i.e. a row in a table), and inserted into a document
    ~< templates(Template):
      # the following three properties determine whether or not the system should choose this template as the view, given a particulat model
      # the classFilter is NULL if the template can apply to any model type, otherwise it specified the model type that this template can apply to
      classFilter(string): null
      # if set, this template is only viewable by the owner of the model it shows
      ownerOnly(boolean): false
      # the variant allows a particular type of view on a model to be requested. For example you could request the 'tablerow' variant for a user model
      variant(string): null

      # the dom string that will be inserted into the document (after customization using the model)
      dom(text): null

      # the original file that this template was loaded from
      filename(string): null

      # ==== links

      # a template may show a number of fields, so clients viewing the template will need to be updated if they change
      ~< displayedFields(TemplateDisplayedField):
        as: template
        field(string): null

      # a template may invoke other templates to embed within it.
      # Eg a user template may display its name as editable textbox using a reusable component, rather than including the specifics in each template that uses that type of textbox.
      ~< subtemplates(Subtemplate):
        as: template
        # the domField is the name of the subtemplate as displayed in the final document. It can be any string.
        domField(string): null
        # the variant to use when finding the template to use for this subtemplate
        variant(string): null
        # if specified, this can specify the model to use for the subtemplate. This is often 'user__me' allowing a page to have a sensible nav bar.
        modelView(string): null

      # a template may display child models. Eg a user template may display its posts, so the template for the user would have a posts subtemplate saying how to display them
      ~< templateChildren(TemplateChild):
        as: template
        # the domField is the name of the template child as displayed in the final document. It can be any string.
        domField(string): null
        # the name of the link hanging off this model (eg posts)
        modelField(string): null
        # the variant to use when finding the template to use for this child
        variant(string): null
        # the classFilter is NULL if the template can apply to any model type, otherwise it specified the model type that this template can apply to
        classFilter(string): null
        # if set, this template is only viewable by the owner of the model it shows
        ownerOnly(boolean): false
*/
