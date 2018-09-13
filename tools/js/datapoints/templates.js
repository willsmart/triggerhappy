const ConvertIds = require('./convert-ids');
const PublicApi = require('../general/public-api');
const mapValues = require('../general/map-values');
const DomGenerator = require('../dom/dom-generator');

// other implied dependencies

//const DatapointCache = require('./datapoint-cache'); // via constructor arg: cache
//    uses getOrCreateDatapoint, queueValidationJob

//const Datapoint = require('./datapoint'); // via cache.getOrCreateDatapoint
//    uses watch, stopWatching, valueIfAny, invalidate, invalid, setVirtualField

// API is auto-generated at the bottom from the public interface of this class

class Templates {
  // public methods
  static publicMethods() {
    return ['load', 'getTemplateReferencingDatapoint', 'template'];
  }

  constructor({ cache, htmlToElement, appDbRowId = 1 }) {
    const templates = this;

    templates.cache = cache;
    templates.appDbRowId = appDbRowId;
    templates.templatesByRowId = {};
    templates.templatesByVariantClassOwnership = {};
    templates.bubbledTemplatesByVariantClassOwnership = {};

    templates.domGenerator = new DomGenerator({
      htmlToElement,
      cache: {
        getExistingDatapoint: () => undefined,
        getOrCreateDatapoint: () => undefined,
      },
    });

    this.callbackKey = cache
      .getOrCreateDatapoint({
        datapointId: this.appTemplatesDatapointId,
      })
      .watch({
        onchange: datapoint => {
          if (Array.isArray(datapoint.valueIfAny)) {
            templates.setTemplateRowIds({
              rowIds: datapoint.valueIfAny,
            });
          }
        },
      });
  }

  template({ rowId }) {
    return this.templatesByRowId[rowId];
  }

  get appTemplatesDatapointId() {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: 'templates',
    }).datapointId;
  }

  appTemplateDatapointId({ variant, classFilter, ownerOnly }) {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: `useTemplate_${variant ? `V_${variant}_` : ''}${classFilter ? `C_${classFilter}_` : ''}${
        ownerOnly ? '_private' : ''
      }`,
    }).datapointId;
  }

  setTemplateRowIds({ rowIds }) {
    const templates = this;

    const missing = mapValues(templates.templatesByRowId, () => true);
    for (const rowId of rowIds) {
      if (templates.templatesByRowId[rowId]) {
        delete missing[rowId];
        continue;
      }
      templates.templatesByRowId[rowId] = new Template({
        templates,
        rowId,
      });
    }

    for (const rowId of Object.keys(missing)) {
      templates.templatesByRowId[rowId].delete();
      delete templates.templatesByRowId[rowId];
    }
  }

  getTemplateReferencingDatapoint({ variant, classFilter, ownerOnly }) {
    return this.treeNode({
      canCreate: true,
      variant,
      classFilter,
      ownerOnly,
    }).datapoint;
  }

  removeFromTemplatesTree({ variant, classFilter, ownerOnly }) {
    this.addToTemplatesTree({
      variant,
      classFilter,
      ownerOnly,
    });
  }

  addToTemplatesTree({ template, variant, classFilter, ownerOnly }) {
    const templates = this,
      node = templates.treeNode({
        canCreate: true,
        variant,
        classFilter,
        ownerOnly,
      }),
      templateWas = node.template;
    if (templateWas === template) return;

    for (const child of node.subtree) {
      if (child.template === templateWas) {
        if (template) {
          child.template = template;
          child.datapoint.invalidate();
        } else {
          const useParent = child.parents.find(parent => parent.template),
            useTemplate = useParent ? useParent.template : undefined;

          if (child.template !== useTemplate) {
            child.template = useTemplate;
            child.datapoint.invalidate();
          }
        }
      }
    }
  }

  treeNode({ canCreate = false, variant, classFilter, ownerOnly }) {
    const templates = this;

    function newTreeNode({ variant, classFilter, ownerOnly, parents }) {
      const node = {
        variant,
        classFilter,
        ownerOnly,
        parents,
      };
      node.subtree = [node];
      for (const parent of parents) parent.subtree.push(node);
      node.datapoint = templates.cache.getOrCreateDatapoint({
        datapointId: templates.appTemplateDatapointId({
          variant,
          classFilter,
          ownerOnly,
        }),
      });
      node.datapoint.setVirtualField({
        isId: true,
        isMultiple: false,
        getterFunction: () => {
          return node.template ? [node.template.rowId] : [];
        },
      });
      node.datapoint.invalidate();
      node.callbackKey = node.datapoint.watch({});
      return node;
    }

    let tree = templates.tree;
    if (!tree) {
      if (!canCreate) return;
      tree = templates.tree = newTreeNode({
        parents: [],
      });
    }
    if (ownerOnly) {
      if (!tree.private) {
        if (canCreate) {
          tree.private = newTreeNode({
            ownerOnly,
            parents: [tree],
          });
        } else return;
      }
      tree = tree.private;
    }

    function withClassFilter({ node, classFilter }) {
      if (!classFilter) return node;
      if (node.classFilters && node.classFilters[classFilter]) return node.classFilters[classFilter];
      if (!canCreate) return;

      const parents = node.parents.slice();
      for (const parent of node.parents) {
        parents.unshift(
          withClassFilter({
            node: parent,
            classFilter,
          })
        );
      }
      parents.unshift(node);

      if (!node.classFilters) node.classFilters = {};
      return (node.classFilters[classFilter] = newTreeNode({
        classFilter,
        variant: node.variant,
        ownerOnly: node.ownerOnly,
        parents,
      }));
    }

    function withVariant({ node, variant }) {
      if (!variant) return node;
      if (node.variants && node.variants[variant]) return node.variants[variant];
      if (!canCreate) return;

      const parents = node.parents.slice();
      for (const parent of node.parents) {
        parents.unshift(
          withVariant({
            node: parent,
            variant,
          })
        );
      }
      parents.unshift(node);

      if (!node.variants) node.variants = {};
      return (node.variants[variant] = newTreeNode({
        classFilter: classFilter,
        variant,
        ownerOnly: node.ownerOnly,
        parents,
      }));
    }

    return withVariant({
      variant,
      node: withClassFilter({
        classFilter,
        node: tree,
      }),
    });
  }
}

class Template {
  // TODO publicapi
  constructor({ templates, rowId }) {
    const template = this,
      cache = templates.cache;

    template.templates = templates;
    template.datapoints = {};
    const callbackKey = (template.callbackKey = `${templates.callbackKey}:${rowId}`);

    Object.assign(
      template,
      ConvertIds.decomposeId({
        rowId,
      })
    );

    for (const fieldName of ['classFilter', 'ownerOnly', 'variant']) {
      const datapoint = (template.datapoints[fieldName] = cache.getOrCreateDatapoint(
        ConvertIds.recomposeId(template, {
          fieldName,
        })
      ));
      datapoint.watch({
        callbackKey,
        onvalid: () => {
          template.refreshInTemplatesTree();
        },
        oninvalid: () => {
          template.refreshInTemplatesTree();
        },
      });
    }

    const datapoint = cache.getOrCreateDatapoint({
      datapointId: ConvertIds.recomposeId({
        rowId,
        fieldName: 'dom',
      }).datapointId,
    });
    datapoint.watch({
      callbackKey,
      onchange: datapoint => {
        template.updateDom(datapoint.valueIfAny);
      },
    });

    template.updateDom(datapoint.valueIfAny);

    template.refreshInTemplatesTree();
  }

  updateDom(domString) {
    const template = this,
      { templates } = template;

    if (!(domString && typeof domString == 'string')) domString = '<div></div>';

    if (template.domString == domString) return;
    template.domString = domString;

    const elements = templates.domGenerator.createElementsUsingDatapointIds({
      domString,
      rowId: 'placeholder__1',
    });

    const displayedFields = {},
      children = {},
      embedded = [];

    elements.forEach(addElement);

    function addElement(element) {
      const childrenDatapointId = element.getAttribute('nobo-children-dpid'),
        valueDatapointIdsString = element.getAttribute('nobo-val-dpids'),
        valueDatapointIds = valueDatapointIdsString ? valueDatapointIdsString.split(' ') : undefined;

      if (childrenDatapointId) {
        const datapointInfo = ConvertIds.decomposeId({ datapointId: childrenDatapointId });
        children[datapointInfo.fieldName] = children[datapointInfo.fieldName] || {};
        children[datapointInfo.fieldName][element.getAttribute('variant') || 'default'] = true;
      }
      if (
        (element.classList.contains('model-child') && element.getAttribute('model')) ||
        element.hasAttribute('variant')
      ) {
        const rowId = element.getAttribute('model'),
          variant = element.getAttribute('variant');
        if (!embedded.find(val => val.rowId === rowId && val.variant === variant)) {
          embedded.push({ rowId, variant });
        }
      }
      if (valueDatapointIds) {
        for (const datapointId of valueDatapointIds) {
          const datapointInfo = ConvertIds.decomposeId({ datapointId: datapointId });
          displayedFields[datapointInfo.fieldName] = true;
        }
      }
      for (const child of element.childNodes) {
        if (child.nodeType == 1) addElement(child);
      }
    }

    template.displayedFields = Object.keys(displayedFields);
    template.embedded = embedded;
    template.children = Object.keys(children).map(fieldName => ({
      fieldName,
      variants: Object.keys(children[fieldName]),
    }));
  }

  refreshInTemplatesTree() {
    const template = this,
      templates = template.templates;

    const vcoWas = template._variantClassFilterOwnership,
      vco = template.variantClassFilterOwnership;
    if (vco) vco.template = template;

    if (vco) {
      if (vcoWas) {
        if (
          vco.variant == vcoWas.variant &&
          vco.classFilter == vcoWas.classFilter &&
          vco.ownerOnly == vcoWas.ownerOnly
        ) {
          return;
        }
        templates.removeFromTemplatesTree(vcoWas);
      }
      templates.addToTemplatesTree(vco);
      template._variantClassFilterOwnership = vco;
    } else {
      if (vcoWas) templates.removeFromTemplatesTree(vcoWas);
      delete template._variantClassFilterOwnership;
    }
  }

  get variantClassFilterOwnership() {
    return this.valuesOfDatapoints({
      fieldNames: ['variant', 'classFilter', 'ownerOnly'],
      allOrNothing: true,
    });
  }

  valuesOfDatapoints({ fieldNames, allOrNothing = false }) {
    const template = this;
    const ret = {};
    let hasInvalid = false;
    for (const fieldName of fieldNames) {
      const datapoint = template.datapoints[fieldName];

      if (!datapoint || datapoint.invalid) hasInvalid = true;
      else ret[fieldName] = datapoint.valueIfAny;
    }
    if (hasInvalid) {
      template.templates.cache.queueValidationJob();
      if (allOrNothing) return;
    }

    return ret;
  }

  delete() {
    const template = this,
      templates = template.templates,
      callbackKey = template.callbackKey;

    for (const datapoint of Object.values(template.datapoints)) {
      datapoint.stopWatching({
        callbackKey,
      });
    }
    template.datapoints = {};
    templates.removeFromTemplatesTree(vcoWas);
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: Templates,
  hasExposedBackDoor: true,
});