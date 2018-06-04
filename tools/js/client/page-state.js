const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const SharedState = require("../dom/shared-state");
const ClientDatapoints = require("../dom/client-datapoints");

let globalPageState;

// API is auto-generated at the bottom from the public interface of this class

class PageState {
  // public methods
  static publicMethods() {
    return ["visit"];
  }

  constructor({ getDatapoint, defaultPageDatapointInfo } = {}) {
    const pageState = this;

    pageState.defaultPageDatapointInfo =
      defaultPageDatapointInfo ||
      ConvertIds.recomposeId({
        typeName: "app",
        dbRowId: 1,
        fieldName: ""
      });

    pageState.getDatapoint = getDatapoint || ClientDatapoints.global.getDatapoint;

    window.onpopstate = event => {
      const pageState = this;

      visit();
    };

    pageState.callbackKey = SharedState.global.watch({
      onchangedstate: function(diff, changes, forEachChangedKeyPath) {
        forEachChangedKeyPath((keyPath, change) => {
          switch (keyPath.length) {
            case 0:
              return true;
            case 1:
              return keyPath[0] == "datapointsById";
            case 2:
              if (keyPath[0] == "datapointsById") {
                if (keyPath[1] == "page" && Array.isArray(change.is)) {
                  pageState.visit(change.is.length && typeof change[0] == "string" ? change.is[0] : undefined);
                }
                if (keyPath[1] == PageState.currentWindowState.titleDatapointId) {
                  pageState.updateState(PageState.currentWindowState.pageDatapointId);
                }
              }
            default:
              return false;
          }
        });
      }
    });
  }

  static get global() {
    return globalPageState ? globalPageState : (globalPageState = new PageState());
  }

  static get currentWindowState() {
    const oldState = window.history.state;
    return oldState && typeof oldState == "object" && oldState.nobo ? oldState : {};
  }

  static get datapointInfoFromPath() {
    const pathName = window.location.pathname,
      match = /^\/(\w+)\/(?:(\d+)|(\w+))(?:\/(\w*))?$/.exec(pathName);
    if (!match) return;
    return ConvertIds.recomposeId({
      typeName: match[1],
      dbRowId: +match[2],
      proxyKey: match[3],
      fieldName: match[4] || ""
    });
  }

  visit(rowOrDatapointId) {
    const pageState = this;

    const state = pageState.updateState(rowOrDatapointId);

    SharedState.global.withTemporaryState(
      tempState => (tempState.atPath("datapointsById").page = [state.pageDatapointId])
    );
  }

  updateState(rowOrDatapointId) {
    const pageState = this;

    let pageDatapointInfo = ConvertIds.recomposeId({
      proxyableRowId: rowOrDatapointId,
      proxyableDatapointId: rowOrDatapointId,
      fieldName: "",
      permissive: true
    });
    if (!pageDatapointInfo) {
      pageDatapointInfo = PageState.datapointInfoFromPath;
      if (!pageDatapointInfo) {
        pageDatapointInfo = pageState.defaultPageDatapointInfo;
      }
    }
    const pageDatapointId = pageDatapointInfo.proxyableDatapointId,
      titleDatapointId = ConvertIds.recomposeId(pageDatapointInfo, {
        fieldName: "name"
      }).proxyableDatapointId;

    const title = pageState.getDatapoint(titleDatapointId, "");

    const oldState = PageState.currentWindowState,
      newState = {
        nobo: true,
        pageDatapointId,
        titleDatapointId,
        title
      };

    if (!oldState.nobo) {
      window.history.replaceState(newState, title, pageState.pathNameForState(newState));
    } else if (newState.pageDatapointId == oldState.pageDatapointId) {
      if (newState.title != oldState.title) {
        window.history.replaceState(newState, title, pageState.pathNameForState(newState));
      }
    } else {
      window.history.pushState(newState, title, pageState.pathNameForState(newState));
    }

    return newState;
  }

  pathNameForState(state) {
    const pageState = this,
      datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId: state.pageDatapointId, permissive: true });
    if (!datapointInfo) return;
    const regex = /(?=((?:[\!\$&'\(\)\*\+,;=a-zA-Z0-9\-._~:@\/?]|%[0-9a-fA-F]{2})*))\1./g,
      titleForFragment = !state.title ? undefined : state.title.substring(0, 100).replace(regex, "$1-");

    return `/${datapointInfo.typeName}/${datapointInfo.dbRowId || datapointInfo.proxyKey}${
      datapointInfo.fieldName ? `/${datapointInfo.fieldName}` : ""
    }${titleForFragment ? `#${titleForFragment}` : ""}`;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: PageState,
  hasExposedBackDoor: true
});