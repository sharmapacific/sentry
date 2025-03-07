import React from 'react';
import styled from 'react-emotion';
import {get} from 'lodash';
import color from 'color';
import 'intersection-observer'; // this is a polyfill

import {t} from 'app/locale';
import {defined, OmitHtmlDivProps} from 'app/utils';
import space from 'app/styles/space';
import Count from 'app/components/count';
import Tooltip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';

import {
  toPercent,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  getHumanDuration,
} from './utils';
import {SpanType, ParsedTraceType} from './types';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './header';
import {SPAN_ROW_HEIGHT, SpanRow, zIndex} from './styles';
import * as DividerHandlerManager from './dividerHandlerManager';
import * as CursorGuideHandler from './cursorGuideHandler';
import SpanDetail from './spanDetail';

// TODO: maybe use babel-plugin-preval
// for (let i = 0; i <= 1.0; i += 0.01) {
//   INTERSECTION_THRESHOLDS.push(i);
// }
const INTERSECTION_THRESHOLDS: Array<number> = [
  0,
  0.01,
  0.02,
  0.03,
  0.04,
  0.05,
  0.06,
  0.07,
  0.08,
  0.09,
  0.1,
  0.11,
  0.12,
  0.13,
  0.14,
  0.15,
  0.16,
  0.17,
  0.18,
  0.19,
  0.2,
  0.21,
  0.22,
  0.23,
  0.24,
  0.25,
  0.26,
  0.27,
  0.28,
  0.29,
  0.3,
  0.31,
  0.32,
  0.33,
  0.34,
  0.35,
  0.36,
  0.37,
  0.38,
  0.39,
  0.4,
  0.41,
  0.42,
  0.43,
  0.44,
  0.45,
  0.46,
  0.47,
  0.48,
  0.49,
  0.5,
  0.51,
  0.52,
  0.53,
  0.54,
  0.55,
  0.56,
  0.57,
  0.58,
  0.59,
  0.6,
  0.61,
  0.62,
  0.63,
  0.64,
  0.65,
  0.66,
  0.67,
  0.68,
  0.69,
  0.7,
  0.71,
  0.72,
  0.73,
  0.74,
  0.75,
  0.76,
  0.77,
  0.78,
  0.79,
  0.8,
  0.81,
  0.82,
  0.83,
  0.84,
  0.85,
  0.86,
  0.87,
  0.88,
  0.89,
  0.9,
  0.91,
  0.92,
  0.93,
  0.94,
  0.95,
  0.96,
  0.97,
  0.98,
  0.99,
  1.0,
];

const TOGGLE_BUTTON_MARGIN_RIGHT = 8;
const TOGGLE_BUTTON_MAX_WIDTH = 40;
const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;
const MARGIN_LEFT = 8;

const getDurationDisplay = ({
  width,
  left,
}: {
  width: undefined | number;
  left: undefined | number;
}) => {
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }
  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }
  if (left > spaceNeeded) {
    return 'left';
  }
  return 'inset';
};

type SpanBarProps = {
  trace: Readonly<ParsedTraceType>;
  span: Readonly<SpanType>;
  spanBarColour: string;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  continuingTreeDepths: Array<number>;
  showSpanTree: boolean;
  numOfSpanChildren: number;
  spanNumber: number;
  isLast?: boolean;
  isRoot?: boolean;
  toggleSpanTree: () => void;
};

type SpanBarState = {
  showDetail: boolean;
};

class SpanBar extends React.Component<SpanBarProps, SpanBarState> {
  state: SpanBarState = {
    showDetail: false,
  };

  spanRowDOMRef = React.createRef<HTMLDivElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;

  toggleDisplayDetail = () => {
    this.setState(state => {
      return {
        showDetail: !state.showDetail,
      };
    });
  };

  renderDetail = ({isVisible}: {isVisible: boolean}) => {
    if (!this.state.showDetail || !isVisible) {
      return null;
    }

    const {span} = this.props;

    return <SpanDetail span={span} />;
  };

  getBounds = (): {
    warning: undefined | string;
    left: undefined | number;
    width: undefined | number;
    isSpanVisibleInView: boolean;
  } => {
    const {span, generateBounds} = this.props;

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL': {
        return {
          warning: t('Trace timestamps are equal'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'INVALID_VIEW_WINDOW': {
        return {
          warning: t('Invalid view window'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_EQUAL': {
        return {
          warning: t('The start and end timestamps are equal'),
          left: bounds.start,
          width: 0.00001,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_REVERSED': {
        return {
          warning: t('The start and end timestamps are reversed'),
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_STABLE': {
        return {
          warning: void 0,
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      default: {
        const _exhaustiveCheck: never = bounds;
        return _exhaustiveCheck;
      }
    }
  };

  renderSpanTreeConnector = ({hasToggler}: {hasToggler: boolean}) => {
    const {isLast, isRoot, treeDepth, continuingTreeDepths, span} = this.props;
    if (isRoot) {
      return null;
    }

    const connectorBars: Array<React.ReactNode> = continuingTreeDepths.map(depth => {
      const left = ((treeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 1) * -1;
      return <ConnectorBar style={{left}} key={`${span.span_id}-${depth}`} />;
    });

    return (
      <SpanTreeConnector isLast={isLast} hasToggler={hasToggler}>
        {connectorBars}
      </SpanTreeConnector>
    );
  };

  renderSpanTreeToggler = ({left}: {left: number}) => {
    const {numOfSpanChildren} = this.props;

    const chevronSrc = this.props.showSpanTree ? 'icon-chevron-up' : 'icon-chevron-down';
    const chevron = <Chevron src={chevronSrc} />;

    if (numOfSpanChildren <= 0) {
      return (
        <SpanTreeTogglerContainer style={{left: `${left}px`}}>
          {this.renderSpanTreeConnector({hasToggler: false})}
        </SpanTreeTogglerContainer>
      );
    }

    return (
      <SpanTreeTogglerContainer style={{left: `${left}px`}} hasToggler>
        {this.renderSpanTreeConnector({hasToggler: true})}
        <SpanTreeToggler
          isExpanded={this.props.showSpanTree}
          onClick={event => {
            event.stopPropagation();

            this.props.toggleSpanTree();
          }}
        >
          <span style={{marginRight: '2px', textAlign: 'center'}}>
            <Count value={numOfSpanChildren} />
          </span>
          <div style={{marginRight: '2px', width: '5px', textAlign: 'right'}}>
            {chevron}
          </div>
        </SpanTreeToggler>
      </SpanTreeTogglerContainer>
    );
  };

  renderTitle = () => {
    const {span, treeDepth} = this.props;

    const op = span.op ? <strong>{`${span.op} \u2014 `}</strong> : '';
    const description = get(span, 'description', span.span_id);

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

    return (
      <SpanBarTitleContainer>
        {this.renderSpanTreeToggler({left})}
        <SpanBarTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <span>
            {op}
            {description}
          </span>
        </SpanBarTitle>
      </SpanBarTitleContainer>
    );
  };

  connectObservers = () => {
    if (!this.spanRowDOMRef.current) {
      return;
    }

    this.disconnectObservers();

    /**

    We track intersections events between the span bar's DOM element
    and the viewport's (root) intersection area. the intersection area is sized to
    exclude the minimap. See below.

    By default, the intersection observer's root intersection is the viewport.
    We adjust the margins of this root intersection area to exclude the minimap's
    height. The minimap's height is always fixed.

      VIEWPORT (ancestor element used for the intersection events)
    +--+-------------------------+--+
    |  |                         |  |
    |  |       MINIMAP           |  |
    |  |                         |  |
    |  +-------------------------+  |  ^
    |  |                         |  |  |
    |  |       SPANS             |  |  | ROOT
    |  |                         |  |  | INTERSECTION
    |  |                         |  |  | OBSERVER
    |  |                         |  |  | HEIGHT
    |  |                         |  |  |
    |  |                         |  |  |
    |  |                         |  |  |
    |  +-------------------------+  |  |
    |                               |  |
    +-------------------------------+  v

     */

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!this._mounted) {
            return;
          }

          const shouldMoveMinimap =
            this.props.trace.numOfSpans > NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (!shouldMoveMinimap) {
            return;
          }
          const spanNumber = this.props.spanNumber;

          const minimapSlider = document.getElementById('minimap-background-slider');

          if (!minimapSlider) {
            return;
          }

          // NOTE: THIS IS HACKY.
          //
          // IntersectionObserver.rootMargin is un-affected by the browser's zoom level.
          // The margins of the intersection area needs to be adjusted.
          // Thus, IntersectionObserverEntry.rootBounds may not be what we expect.
          //
          // We address this below.
          //
          // Note that this function was called whenever an intersection event occurred wrt
          // the thresholds.
          //
          if (entry.rootBounds) {
            // After we create the IntersectionObserver instance with rootMargin set as:
            // -${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px
            //
            // we can introspect the rootBounds to infer the zoomlevel.
            //
            // we always expect entry.rootBounds.top to equal MINIMAP_CONTAINER_HEIGHT

            const actualRootTop = Math.ceil(entry.rootBounds.top);

            if (actualRootTop !== MINIMAP_CONTAINER_HEIGHT && actualRootTop > 0) {
              // we revert the actualRootTop value by the current zoomLevel factor
              const normalizedActualTop = actualRootTop / this.zoomLevel;

              const zoomLevel = MINIMAP_CONTAINER_HEIGHT / normalizedActualTop;
              this.zoomLevel = zoomLevel;

              // we reconnect the observers; the callback functions may be invoked
              this.connectObservers();

              // NOTE: since we cannot guarantee that the callback function is invoked on
              //       the newly connected observers, we continue running this function.
            }
          }

          // root refers to the root intersection rectangle used for the IntersectionObserver
          const rectRelativeToRoot = entry.boundingClientRect as DOMRect;

          const bottomYCoord = rectRelativeToRoot.y + rectRelativeToRoot.height;

          // refers to if the rect is out of view from the viewport
          const isOutOfViewAbove = rectRelativeToRoot.y < 0 && bottomYCoord < 0;

          if (isOutOfViewAbove) {
            return;
          }

          const relativeToMinimap = {
            top: rectRelativeToRoot.y - MINIMAP_CONTAINER_HEIGHT,
            bottom: bottomYCoord - MINIMAP_CONTAINER_HEIGHT,
          };

          const rectBelowMinimap =
            relativeToMinimap.top > 0 && relativeToMinimap.bottom > 0;

          if (rectBelowMinimap) {
            // if the first span is below the minimap, we scroll the minimap
            // to the top. this addresss spurious scrolling to the top of the page
            if (spanNumber <= 1) {
              minimapSlider.style.top = '0px';
              return;
            }
            return;
          }

          const inAndAboveMinimap = relativeToMinimap.bottom <= 0;

          if (inAndAboveMinimap) {
            return;
          }

          // invariant: spanNumber >= 1

          const numberOfMovedSpans = spanNumber - 1;
          const totalHeightOfHiddenSpans = numberOfMovedSpans * MINIMAP_SPAN_BAR_HEIGHT;
          const currentSpanHiddenRatio = 1 - entry.intersectionRatio;

          const panYPixels =
            totalHeightOfHiddenSpans + currentSpanHiddenRatio * MINIMAP_SPAN_BAR_HEIGHT;

          // invariant: this.props.trace.numOfSpansend - spanNumberToStopMoving + 1 = NUM_OF_SPANS_FIT_IN_MINI_MAP

          const spanNumberToStopMoving =
            this.props.trace.numOfSpans + 1 - NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (spanNumber > spanNumberToStopMoving) {
            // if the last span bar appears on the minimap, we do not want the minimap
            // to keep panning upwards
            minimapSlider.style.top = `-${spanNumberToStopMoving *
              MINIMAP_SPAN_BAR_HEIGHT}px`;
            return;
          }

          minimapSlider.style.top = `-${panYPixels}px`;
        });
      },
      {
        threshold: INTERSECTION_THRESHOLDS,
        rootMargin: `-${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px`,
      }
    );

    this.intersectionObserver.observe(this.spanRowDOMRef.current);
  };

  disconnectObservers = () => {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  };

  componentDidMount() {
    this._mounted = true;
    if (this.spanRowDOMRef.current) {
      this.connectObservers();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disconnectObservers();
  }

  renderCursorGuide = () => {
    return (
      <CursorGuideHandler.Consumer>
        {({
          showCursorGuide,
          traceViewMouseLeft,
        }: {
          showCursorGuide: boolean;
          traceViewMouseLeft: number | undefined;
        }) => {
          if (!showCursorGuide || !traceViewMouseLeft) {
            return null;
          }

          return (
            <CursorGuide
              style={{
                left: toPercent(traceViewMouseLeft),
              }}
            />
          );
        }}
      </CursorGuideHandler.Consumer>
    );
  };

  renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    if (this.state.showDetail) {
      // we would like to hide the divider lines when the span details
      // has been expanded
      return null;
    }

    const {
      dividerPosition,
      addDividerLineRef,
      addGhostDividerLineRef,
    } = dividerHandlerChildrenProps;

    // We display the ghost divider line for whenever the divider line is being dragged.
    // The ghost divider line indicates the original position of the divider line
    const ghostDivider = (
      <DividerLine
        innerRef={addGhostDividerLineRef()}
        style={{
          left: toPercent(dividerPosition),
          display: 'none',
        }}
        onClick={event => {
          // the ghost divider line should not be interactive.
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );

    return (
      <React.Fragment>
        {ghostDivider}
        <DividerLine
          innerRef={addDividerLineRef()}
          style={{
            left: toPercent(dividerPosition),
          }}
          onMouseEnter={() => {
            dividerHandlerChildrenProps.setHover(true);
          }}
          onMouseLeave={() => {
            dividerHandlerChildrenProps.setHover(false);
          }}
          onMouseOver={() => {
            dividerHandlerChildrenProps.setHover(true);
          }}
          onMouseDown={dividerHandlerChildrenProps.onDragStart}
          onClick={event => {
            // we prevent the propagation of the clicks from this component to prevent
            // the span detail from being opened.
            event.stopPropagation();
          }}
        />
      </React.Fragment>
    );
  };

  renderWarningText = ({warningText}: {warningText?: string} = {}) => {
    if (!warningText) {
      return null;
    }

    return (
      <Tooltip title={warningText}>
        <WarningIcon src="icon-circle-exclamation" />
      </Tooltip>
    );
  };

  renderHeader = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    const {span, spanBarColour, spanNumber} = this.props;

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = Math.abs(endTimestamp - startTimestamp);

    const durationString = getHumanDuration(duration);

    const bounds = this.getBounds();

    const {dividerPosition} = dividerHandlerChildrenProps;

    const displaySpanBar = defined(bounds.left) && defined(bounds.width);

    const durationDisplay = getDurationDisplay(bounds);

    return (
      <SpanRowCellContainer>
        <SpanRowCell
          showDetail={this.state.showDetail}
          style={{
            left: 0,
            width: toPercent(dividerPosition),
          }}
        >
          {this.renderTitle()}
        </SpanRowCell>
        <SpanRowCell
          showDetail={this.state.showDetail}
          showStriping={spanNumber % 2 !== 0}
          style={{
            left: toPercent(dividerPosition),
            width: toPercent(1 - dividerPosition),
          }}
        >
          {displaySpanBar && (
            <SpanBarRectangle
              style={{
                backgroundColor: spanBarColour,
                left: toPercent(bounds.left || 0),
                width: toPercent(bounds.width || 0),
              }}
            >
              <DurationPill durationDisplay={durationDisplay}>
                {durationString}
                {this.renderWarningText({warningText: bounds.warning})}
              </DurationPill>
            </SpanBarRectangle>
          )}
          {this.renderCursorGuide()}
        </SpanRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
      </SpanRowCellContainer>
    );
  };

  render() {
    const bounds = this.getBounds();

    const isSpanVisibleInView = bounds.isSpanVisibleInView;

    return (
      <SpanRow
        innerRef={this.spanRowDOMRef}
        visible={isSpanVisibleInView}
        showBorder={this.state.showDetail}
        onClick={() => {
          this.toggleDisplayDetail();
        }}
      >
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => {
            return this.renderHeader(dividerHandlerChildrenProps);
          }}
        </DividerHandlerManager.Consumer>
        {this.renderDetail({isVisible: isSpanVisibleInView})}
      </SpanRow>
    );
  }
}

const getBackgroundColor = ({
  showStriping,
  showDetail,
  theme,
}: {
  showStriping?: boolean;
  showDetail?: boolean;
  theme: any;
}) => {
  if (!theme) {
    return 'white';
  }

  if (showDetail) {
    return theme.offWhite2;
  }
  return showStriping ? theme.offWhite : 'white';
};

type SpanRowCellProps = OmitHtmlDivProps<{
  showStriping?: boolean;
  showDetail?: boolean;
}>;

const SpanRowCell = styled('div')<SpanRowCellProps>`
  position: absolute;
  padding: ${space(0.5)} 1px;
  height: 100%;
  overflow: hidden;
  background-color: ${p => getBackgroundColor(p)};
`;

const SpanRowCellContainer = styled('div')`
  position: relative;
  height: ${SPAN_ROW_HEIGHT}px;

  &:hover ${SpanRowCell} {
    background-color: ${p =>
      color(p.theme.offWhite2)
        .alpha(0.4)
        .string()};
  }
`;

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: #e03e2f;

  transform: translateX(-50%);

  height: 100%;
`;

export const DividerLine = styled('div')`
  position: absolute;
  height: 100%;
  width: 1px;
  transform: translateX(-50%);

  /* increase hit target */
  border-width: 0 5px;
  border-color: rgba(0, 0, 0, 0);
  border-style: solid;
  box-sizing: content-box;
  background-clip: content-box;

  background-color: #cdc7d5;
  z-index: ${zIndex.dividerLine};

  &.hovering {
    width: 3px;
    cursor: col-resize;
  }
`;

const SpanBarTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  user-select: none;
`;

const SpanBarTitle = styled('div')`
  position: relative;
  height: 100%;
  color: ${p => p.theme.gray4};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  display: flex;
  flex: 1;
  align-items: center;
`;

type TogglerTypes = OmitHtmlDivProps<{
  hasToggler?: boolean;
  isLast?: boolean;
}>;

const SpanTreeTogglerContainer = styled('div')<TogglerTypes>`
  position: relative;
  height: 15px;
  width: ${p => (p.hasToggler ? '44px' : '16px')};
  min-width: ${p => (p.hasToggler ? '44px' : '16px')}; /* annoying flex thing */
  margin-right: ${space(1)};
  z-index: ${zIndex.spanTreeToggler};
  display: flex;
  justify-content: flex-end;
`;

// one-off to get the perfect heirarchy
const spanTreeColor = '#D5CEDB';

const SpanTreeConnector = styled('div')<TogglerTypes>`
  height: ${p => (p.isLast ? '85%' : '175%')};
  border-left: 1px solid ${spanTreeColor};
  position: absolute;
  left: 4px;
  top: -5px;

  &:before {
    content: '';
    width: ${p => (p.hasToggler ? '3px' : '8px')};
    position: absolute;
    height: 1px;
    top: ${p => (p.isLast ? '100%' : '50%')};
    transform: translateY(-50%);
    background: ${spanTreeColor};
  }

  &:after {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    /* border radius stops working at 3px */
    transform: scale(0.5) translateY(-100%);
    left: ${p => (p.hasToggler ? '1px' : '6px')};
    top: ${p => (p.isLast ? '100%' : '50%')};
    position: absolute;
    background: ${spanTreeColor};
  }
`;

const ConnectorBar = styled('div')`
  height: 250%;
  border-left: 1px solid ${spanTreeColor};
  top: -5px;
  position: absolute;
`;

const getTogglerTheme = ({isExpanded, theme}) => {
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;
  const activeButtonTheme = isExpanded ? theme.button.primary : theme.button.default;

  return `
    background: ${buttonTheme.background};
    border: 1px solid ${buttonTheme.border};
    color: ${buttonTheme.color};

    &:hover {
      background: ${activeButtonTheme.background};
      border: 1px solid ${activeButtonTheme.border};
      color: ${activeButtonTheme.color};
    }
  `;
};

type SpanTreeTogglerAndDivProps = OmitHtmlDivProps<{
  isExpanded: boolean;
}>;

const SpanTreeToggler = styled('div')<SpanTreeTogglerAndDivProps>`
  white-space: nowrap;
  height: 15px;
  min-width: 25px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 99px;
  transition: all 0.15s ease-in-out;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 0;

  ${p => getTogglerTheme(p)}
`;

const getDurationPillAlignment = ({durationDisplay}) => {
  switch (durationDisplay) {
    case 'left':
      return `right: calc(100% + ${space(0.5)});`;
    case 'right':
      return `left: calc(100% + ${space(0.75)});`;
    default:
      return `
        right: ${space(0.75)};
        color: #fff;
      `;
  }
};

const DurationPill = styled('div')`
  position: absolute;

  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  white-space: nowrap;
  display: flex;
  align-items: center;
  top: 50%;
  transform: translateY(-50%);

  ${getDurationPillAlignment}

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    font-size: 10px;
  }
`;

const SpanBarRectangle = styled('div')`
  position: relative;
  height: 100%;

  min-width: 1px;
  user-select: none;

  transition: border-color 0.15s ease-in-out;
  border-right: 1px solid rgba(0, 0, 0, 0);
`;

const WarningIcon = styled(InlineSvg)`
  margin-left: ${space(0.25)};
`;

const Chevron = styled(InlineSvg)`
  width: 7px;
`;

export default SpanBar;
