
/* A component that renders one or more columns of vertical time slots
----------------------------------------------------------------------------------------------------------------------*/
// We mixin DayTable, even though there is only a single row of days

var TimeGrid = FC.TimeGrid = Grid.extend(DayTableMixin, {

	slotDuration: null, // duration of a "slot", a distinct time segment on given day, visualized by lines
	snapDuration: null, // granularity of time for dragging and selecting
	snapsPerSlot: null,
	slots: null, // an array of custom slots, replacing the automatic slots every 'slotDuration'
	showSlotEndTime: null, // display the end time of each custom slot
	showMinorSlotTime: null, // display the time of 'minor' slots
	snapOnSlots: null, // snap to whole slots when using custom slots
	minTime: null, // Duration object that denotes the first visible time of any given day
	maxTime: null, // Duration object that denotes the exclusive visible end time of any given day
	labelFormat: null, // formatting string for times running along vertical axis
	labelInterval: null, // duration of how often a label should be displayed for a slot

	colEls: null, // cells elements in the day-row background
	slatContainerEl: null, // div that wraps all the slat rows
	slatEls: null, // elements running horizontally across all columns, minus breaks in case slots are used
	nowIndicatorEls: null,

	colCoordCache: null,
	slatCoordCache: null,


	constructor: function() {
		Grid.apply(this, arguments); // call the super-constructor

		this.processOptions();
	},


	// Renders the time grid into `this.el`, which should already be assigned.
	// Relies on the view's colCnt. In the future, this component should probably be self-sufficient.
	renderDates: function() {
		this.el.html(this.renderHtml());
		this.colEls = this.el.find('.fc-day');
		this.slatContainerEl = this.el.find('.fc-slats');
		this.slatEls = this.slatContainerEl.find('tr').not('.fc-timeslots-break');

		this.colCoordCache = new CoordCache({
			els: this.colEls,
			isHorizontal: true
		});
		this.slatCoordCache = new CoordCache({
			els: this.slatEls,
			isVertical: true
		});

		this.renderContentSkeleton();
	},


	// Renders the basic HTML skeleton for the grid
	renderHtml: function() {
		return '' +
			'<div class="fc-bg">' +
				'<table>' +
					this.renderBgTrHtml(0) + // row=0
				'</table>' +
			'</div>' +
			'<div class="fc-slats' + (this.slots ? ' fc-timeslots' : '') + '">' +
				'<table>' +
					this.renderSlatRowHtml() +
				'</table>' +
			'</div>';
	},


	// Generates the HTML for the horizontal "slats" that run width-wise. Has a time axis on a side. Depends on RTL.
	renderSlatRowHtml: function() {
		var view = this.view;
		var isRTL = this.isRTL;
		var html = '';
		var slotTime = moment.duration(+this.minTime); // wish there was .clone() for durations
		var slotDate; // will be on the view's first day, but we only care about its time
		var isLabeled;
		var axisHtml;

		var slots = this.slots;
		if (slots) {
			var slot;
			var nextSlot;
			var startTime;
			var endTime;
			var nextStartTime;
			var breakHtml;
			var breakHeight;
			var slotHeight;

			for (var i = 0; i < slots.length; i++) {
				// generate HTML for each horizontal slot
				var showSlotEndTime = this.showSlotEndTime;
				var showMinorSlotTime = this.showMinorSlotTime;

				slot = slots[i];
				nextSlot = slots[i + 1];
				startTime = this.start.clone().time(slot.start);
				endTime = this.start.clone().time(slot.end);

				if (nextSlot) {
					nextStartTime = this.start.clone().time(nextSlot.start);

					breakHeight = moment.duration(nextStartTime.diff(endTime)).asMinutes();
					breakHtml = (breakHeight > 0) ? '<tr class="fc-timeslots-break" style="height:' + breakHeight + 'px;"><td class="fc-break-axis"></td><td class="fc-timeslots-break-content"></td></tr>' : '';
				}

				slotHeight = moment.duration(endTime.diff(startTime)).asMinutes();

				var timeHtml = '';
				if (showMinorSlotTime === true || !slot.minor) {
					timeHtml = htmlEscape(startTime.format(this.labelFormat));
					if (showSlotEndTime === true) {
						timeHtml += htmlEscape("\n" + endTime.format(this.labelFormat));
					}
				}
				axisHtml =
					'<td class="fc-axis fc-time ' + view.widgetContentClass + '" ' + view.axisStyleAttr() + '>' +
					'<div class="fc-timeslots-axis">' + timeHtml + '</div>' +
					'</td>';

				var slotClasses = [];
				if (slot.className) {
					if (typeof slot.className === "string") {
						slotClasses.push(slot.className);
					}
					else if (Array.isArray(slot.className) === true) {
						for (var j = 0; j < slot.className.length; j++) {
							var cl = slot.className[j];
							if (typeof cl === "string") {
								slotClasses.push(cl);
							}
						}
					}
				}
				if (slot.minor === true) {
					slotClasses.push('fc-minor');
				}
				else {
					slotClasses.push('fc-major');
				}
				html +=
					'<tr class="' + slotClasses.join(" ") + '" '+ 'style="height: '+ slotHeight + 'px">' +
					(!isRTL ? axisHtml : '') +
					'<td class="' + view.widgetContentClass + '"/>' +
					(isRTL ? axisHtml : '') +
					"</tr>"  + breakHtml;
				breakHtml = '';
			}
		}
		else {
			// Calculate the time for each slot
			while (slotTime < this.maxTime) {
				slotDate = this.start.clone().time(slotTime);
				isLabeled = isInt(divideDurationByDuration(slotTime, this.labelInterval));

				axisHtml =
					'<td class="fc-axis fc-time ' + view.widgetContentClass + '" ' + view.axisStyleAttr() + '>' +
						(isLabeled ?
							'<span>' + // for matchCellWidths
								htmlEscape(slotDate.format(this.labelFormat)) +
							'</span>' :
							''
							) +
					'</td>';

				html +=
					'<tr data-time="' + slotDate.format('HH:mm:ss') + '"' +
						(isLabeled ? '' : ' class="fc-minor"') +
						'>' +
						(!isRTL ? axisHtml : '') +
						'<td class="' + view.widgetContentClass + '"/>' +
						(isRTL ? axisHtml : '') +
					"</tr>";

				slotTime.add(this.slotDuration);
			}
		}

		return html;
	},


	/* Options
	------------------------------------------------------------------------------------------------------------------*/


	// Parses various options into properties of this object
	processOptions: function() {
		var view = this.view;
		var slotDuration = view.opt('slotDuration');
		var snapDuration = view.opt('snapDuration');
		var input;

		slotDuration = moment.duration(slotDuration);
		snapDuration = snapDuration ? moment.duration(snapDuration) : slotDuration;

		this.slotDuration = slotDuration;
		this.snapDuration = snapDuration;
		this.snapsPerSlot = slotDuration / snapDuration; // TODO: ensure an integer multiple?

		this.minResizeDuration = snapDuration; // hack

		this.minTime = moment.duration(view.opt('minTime'));
		this.maxTime = moment.duration(view.opt('maxTime'));

		// might be an array value (for TimelineView).
		// if so, getting the most granular entry (the last one probably).
		input = view.opt('slotLabelFormat');
		if ($.isArray(input)) {
			input = input[input.length - 1];
		}

		this.labelFormat =
			input ||
			view.opt('smallTimeFormat'); // the computed default

		// custom slots
		var slots = view.opt('slots');
		if (slots && Array.isArray(slots)) {
			// filter valid slots
			slots = $.grep(slots, function(sl) {
				return sl.hasOwnProperty("start") && sl.hasOwnProperty("end") &&
					typeof(sl.start) === "string" && typeof(sl.end) === "string" &&
					sl.start.match(/^[0-9]{1,2}:[0-9]{1,2}(:[0-9]{1,2})?$/) &&
					sl.end.match(/^[0-9]{1,2}:[0-9]{1,2}(:[0-9]{1,2})?$/) &&
					true;
			});
			if (slots.length >= 2) { // require at least 2 slots to display properly
				// sort slots by start time
				slots.sort(function(sl1, sl2) {
					var start1 = moment(sl1.start, "HH:mm:ss");
					var start2 = moment(sl2.start, "HH:mm:ss");
					if (start1.isBefore(start2)) {
						return -1;
					}
					else if (start2.isBefore(start1)) {
						return 1;
					}
					else {
						return 0;
					}
				});
				// make sure each slot ends after it starts, and before the next one starts
				for (var i = 0; i < slots.length; i++) {
					var start1 = moment(slots[i].start, "HH:mm:ss");
					var end1 = moment(slots[i].end, "HH:mm:ss");
					if (end1.isBefore(start1)) {
						slots[i].end = slots[i].start;
					}
					if (i + 1 < slots.length) {
						var start2 = moment(slots[i+1].start, "HH:mm:ss");
						if (start2.isBefore(end1)) {
							slots[i].end = slots[i+1].start;
						}
					}
				}
				this.slots = slots;

				// options related to slots
				var showSlotEndTime = this.view.opt('showSlotEndTime');
				if (showSlotEndTime !== false) { // defaults to true
					this.showSlotEndTime = true;
				}
				var showMinorSlotTime = this.view.opt('showMinorSlotTime');
				if (showMinorSlotTime !== false) { // defaults to true
					this.showMinorSlotTime = true;
				}
				var snapOnSlots = this.view.opt('snapOnSlots');
				if (snapOnSlots &&
					(snapOnSlots === true || // defaults to false
						snapOnSlots.hasOwnProperty('snapEffectiveDuration') ||
						snapOnSlots.hasOwnProperty('snapPolicy')
					)) {
					this.snapOnSlots = {
						snapEffectiveDuration: false,
						snapPolicy: 'enlarge' // could also be 'closest'
					};
					if (snapOnSlots.snapEffectiveDuration === true) {
						this.snapOnSlots.snapEffectiveDuration = true;
					}
					if (snapOnSlots.snapPolicy === 'closest') {
						this.snapOnSlots.snapPolicy = 'closest';
					}
				}
			}
		}

		input = view.opt('slotLabelInterval');
		this.labelInterval = input ?
			moment.duration(input) :
			this.computeLabelInterval(slotDuration);
	},


	// Computes an automatic value for slotLabelInterval
	computeLabelInterval: function(slotDuration) {
		var i;
		var labelInterval;
		var slotsPerLabel;

		// find the smallest stock label interval that results in more than one slots-per-label
		for (i = AGENDA_STOCK_SUB_DURATIONS.length - 1; i >= 0; i--) {
			labelInterval = moment.duration(AGENDA_STOCK_SUB_DURATIONS[i]);
			slotsPerLabel = divideDurationByDuration(labelInterval, slotDuration);
			if (isInt(slotsPerLabel) && slotsPerLabel > 1) {
				return labelInterval;
			}
		}

		return moment.duration(slotDuration); // fall back. clone
	},


	// Computes a default event time formatting string if `timeFormat` is not explicitly defined
	computeEventTimeFormat: function() {
		return this.view.opt('noMeridiemTimeFormat'); // like "6:30" (no AM/PM)
	},


	// Computes a default `displayEventEnd` value if one is not expliclty defined
	computeDisplayEventEnd: function() {
		return true;
	},


	/* Hit System
	------------------------------------------------------------------------------------------------------------------*/


	prepareHits: function() {
		this.colCoordCache.build();
		this.slatCoordCache.build();
	},


	releaseHits: function() {
		this.colCoordCache.clear();
		// NOTE: don't clear slatCoordCache because we rely on it for computeTimeTop
	},


	queryHit: function(leftOffset, topOffset) {
		var snapsPerSlot = this.snapsPerSlot;
		var colCoordCache = this.colCoordCache;
		var slatCoordCache = this.slatCoordCache;

		if (colCoordCache.isLeftInBounds(leftOffset) && slatCoordCache.isTopInBounds(topOffset)) {
			var colIndex = colCoordCache.getHorizontalIndex(leftOffset);
			var slatIndex = slatCoordCache.getVerticalIndex(topOffset);
			var snapIndex;
			
			if (colIndex != null && slatIndex != null) {
				if(this.slots) {
					var originTop = this.el.offset().top;
					snapIndex = this.snapOnSlots ? slatIndex : Math.round((topOffset - originTop) / this.snapDuration.asMinutes());
				}
				else {
					var slatTop = slatCoordCache.getTopOffset(slatIndex);
					var slatHeight = slatCoordCache.getHeight(slatIndex);
					var partial = (topOffset - slatTop) / slatHeight; // floating point number between 0 and 1
					var localSnapIndex = Math.floor(partial * snapsPerSlot); // the snap # relative to start of slat
					snapIndex = slatIndex * snapsPerSlot + localSnapIndex;
				}

				return {
					col: colIndex,
					snap: snapIndex,
					component: this // needed unfortunately :(
				};
			}
		}
	},


	getHitSpan: function(hit) {
		var start = this.getCellDate(0, hit.col); // row=0
		var time = this.computeSnapTime(hit.snap); // pass in the snap-index
		var end;

		var slots = this.slots;

		start.time(time);
		if (slots && this.snapOnSlots) {
			end = start.clone().time(slots[hit.snap].end);
		}
		else {
			end = start.clone().add(this.snapDuration);
		}

		return { start: start, end: end };
	},


	getHitEl: function(hit) {
		return this.colEls.eq(hit.col);
	},


	/* Dates
	------------------------------------------------------------------------------------------------------------------*/


	rangeUpdated: function() {
		this.updateDayTable();
	},


	// Given a row number of the grid, representing a "snap", returns a time (Duration) from its start-of-day
	computeSnapTime: function(snapIndex) {
		var slots = this.slots;
		if (slots && this.snapOnSlots) {
			var beginTime = this.start.clone();
			var rowTime = this.start.clone().time(slots[Math.min(snapIndex, slots.length - 1)].start);
			return moment.duration(rowTime.diff(beginTime));
		}
		else {
			return moment.duration(this.minTime + this.snapDuration * snapIndex);
		}
	},


	// Slices up the given span (unzoned start/end with other misc data) into an array of segments
	spanToSegs: function(span) {
		var segs = this.sliceRangeByTimes(span);
		var i;

		for (i = 0; i < segs.length; i++) {
			if (this.isRTL) {
				segs[i].col = this.daysPerRow - 1 - segs[i].dayIndex;
			}
			else {
				segs[i].col = segs[i].dayIndex;
			}
		}

		return segs;
	},


	sliceRangeByTimes: function(range) {
		var segs = [];
		var seg;
		var dayIndex;
		var dayDate;
		var dayRange;

		for (dayIndex = 0; dayIndex < this.daysPerRow; dayIndex++) {
			dayDate = this.dayDates[dayIndex].clone(); // TODO: better API for this?
			dayRange = {
				start: dayDate.clone().time(this.minTime),
				end: dayDate.clone().time(this.maxTime)
			};
			seg = intersectRanges(range, dayRange); // both will be ambig timezone
			if (seg) {
				seg.dayIndex = dayIndex;
				segs.push(seg);
			}
		}

		return segs;
	},


	/* Coordinates
	------------------------------------------------------------------------------------------------------------------*/


	updateSize: function(isResize) { // NOT a standard Grid method
		this.slatCoordCache.build();

		if (isResize) {
			this.updateSegVerticals(
				[].concat(this.fgSegs || [], this.bgSegs || [], this.businessSegs || [])
			);
		}
	},


	getTotalSlatHeight: function() {
		return this.slatContainerEl.outerHeight();
	},


	// Computes the top coordinate, relative to the bounds of the grid, of the given date.
	// A `startOfDayDate` must be given for avoiding ambiguity over how to treat midnight.
	computeDateTop: function(date, startOfDayDate) {
		return this.computeTimeTop(
			moment.duration(
				date - startOfDayDate.clone().stripTime()
			)
		);
	},

	// Computes the top coordinate, relative to the bounds of the grid, of the given time (a Duration).
	computeTimeTop: function(time) {
		if (this.slots) {
			return this.computeTimeTopWithSlots(time);
		}
		else {
			return this.computeTimeTopWithoutSlots(time);
		}
	},

	// Computes the top coordinate, relative to the bounds of the grid, of the given time (a Duration),
	// when there are no slots on the grid.
	computeTimeTopWithoutSlots: function(time) {
		var len = this.slatEls.length;
		var slatCoverage = (time - this.minTime) / this.slotDuration; // floating-point value of # of slots covered
		var slatIndex;
		var slatRemainder;

		// compute a floating-point number for how many slats should be progressed through.
		// from 0 to number of slats (inclusive)
		// constrained because minTime/maxTime might be customized.
		slatCoverage = Math.max(0, slatCoverage);
		slatCoverage = Math.min(len, slatCoverage);

		// an integer index of the furthest whole slat
		// from 0 to number slats (*exclusive*, so len-1)
		slatIndex = Math.floor(slatCoverage);
		slatIndex = Math.min(slatIndex, len - 1);

		// how much further through the slatIndex slat (from 0.0-1.0) must be covered in addition.
		// could be 1.0 if slatCoverage is covering *all* the slots
		slatRemainder = slatCoverage - slatIndex;

		return this.slatCoordCache.getTopPosition(slatIndex) +
			this.slatCoordCache.getHeight(slatIndex) * slatRemainder;
	},

	// Computes the top coordinate, relative to the bounds of the grid, of the given time (a Duration),
	// when the grid is made of custom slots
	computeTimeTopWithSlots: function(time) {
		var slots = this.slots;
		var time2 = this.start.clone().time(time); // Convert duration to time;
		var slatIndex = null;
		var isInSlot = false;
		var isInBreakBefore = false;

		var startTime, endTime;
		// look for a matching slot for 'time'
		for (var i = 0; i < slots.length; i++) {
			var slot = slots[i];

			startTime = this.start.clone().time(slot.start);
			if (i === 0 && time2.isBefore(startTime)) {
				// 'time' too early for slots range: no need to go any further,
				// displayed on first row
				return this.slatCoordCache.getTopPosition(0);
			}

			isInBreakBefore = i > 0 && time2.isBefore(startTime);
			if (isInBreakBefore) {
				// found matching slot, 'time' is just before it
				slatIndex = i;
				break;
			}

			endTime = this.start.clone().time(slot.end);
			isInSlot = time2.isSame(startTime) ||
				time2.isBetween(startTime, endTime) ||
				time2.isSame(endTime);
			if (isInSlot) {
				// found matching slot, 'time' is inside it
				slatIndex = i;
				break;
			}
		}

		// not found: 'time' too late for slots range : displayed on last row
		if (slatIndex === null) {
			return this.slatCoordCache.getTopPosition(slots.length);
		}

		// compute position from row's top
		var slatTop = this.slatCoordCache.getTopPosition(slatIndex); // the top position of the furthest whole slot;
		startTime = this.start.clone().time(slots[slatIndex].start);
		if (isInSlot) {
			endTime = this.start.clone().time(slots[slatIndex].end);
			var slotDuration = endTime.diff(startTime);
			var slatRemainder = time2.diff(startTime) / slotDuration; // fraction of slot spanned
			var slatBottom = this.slatCoordCache.getBottomPosition(slatIndex);
			return slatTop + (slatBottom - slatTop) * slatRemainder;
		}
		else { // (isInBreakBefore)
			var previousEndTime = this.start.clone().time(slots[slatIndex-1].end);
			var breakDuration = startTime.diff(previousEndTime);
			var breakRemainder = startTime.diff(time2) / breakDuration; // fraction of break spanned
			var previousSlatBottom = this.slatCoordCache.getBottomPosition(slatIndex - 1);
			return slatTop - (slatTop - previousSlatBottom) * breakRemainder;
		}
	},


	/* Event Drag Visualization
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a visual indication of an event being dragged over the specified date(s).
	// A returned value of `true` signals that a mock "helper" event has been rendered.
	renderDrag: function(eventLocation, seg) {

		if (seg) { // if there is event information for this drag, render a helper event

			// returns mock event elements
			// signal that a helper has been rendered
			return this.renderEventLocationHelper(eventLocation, seg);
		}
		else {
			// otherwise, just render a highlight
			this.renderHighlight(this.eventToSpan(eventLocation));
		}
	},


	// Unrenders any visual indication of an event being dragged
	unrenderDrag: function() {
		this.unrenderHelper();
		this.unrenderHighlight();
	},


	/* Event Resize Visualization
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a visual indication of an event being resized
	renderEventResize: function(eventLocation, seg) {
		return this.renderEventLocationHelper(eventLocation, seg); // returns mock event elements
	},


	// Unrenders any visual indication of an event being resized
	unrenderEventResize: function() {
		this.unrenderHelper();
	},


	/* Event Helper
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a mock "helper" event. `sourceSeg` is the original segment object and might be null (an external drag)
	renderHelper: function(event, sourceSeg) {
		return this.renderHelperSegs(this.eventToSegs(event), sourceSeg); // returns mock event elements
	},


	// Unrenders any mock helper event
	unrenderHelper: function() {
		this.unrenderHelperSegs();
	},


	/* Business Hours
	------------------------------------------------------------------------------------------------------------------*/


	renderBusinessHours: function() {
		this.renderBusinessSegs(
			this.buildBusinessHourSegs()
		);
	},


	unrenderBusinessHours: function() {
		this.unrenderBusinessSegs();
	},


	/* Now Indicator
	------------------------------------------------------------------------------------------------------------------*/


	getNowIndicatorUnit: function() {
		return 'minute'; // will refresh on the minute
	},


	renderNowIndicator: function(date) {
		// seg system might be overkill, but it handles scenario where line needs to be rendered
		//  more than once because of columns with the same date (resources columns for example)
		var segs = this.spanToSegs({ start: date, end: date });
		var top = this.computeDateTop(date, date);
		var nodes = [];
		var i;

		// render lines within the columns
		for (i = 0; i < segs.length; i++) {
			nodes.push($('<div class="fc-now-indicator fc-now-indicator-line"></div>')
				.css('top', top)
				.appendTo(this.colContainerEls.eq(segs[i].col))[0]);
		}

		// render an arrow over the axis
		if (segs.length > 0) { // is the current time in view?
			nodes.push($('<div class="fc-now-indicator fc-now-indicator-arrow"></div>')
				.css('top', top)
				.appendTo(this.el.find('.fc-content-skeleton'))[0]);
		}

		this.nowIndicatorEls = $(nodes);
	},


	unrenderNowIndicator: function() {
		if (this.nowIndicatorEls) {
			this.nowIndicatorEls.remove();
			this.nowIndicatorEls = null;
		}
	},


	/* Selection
	------------------------------------------------------------------------------------------------------------------*/


	// Renders a visual indication of a selection. Overrides the default, which was to simply render a highlight.
	renderSelection: function(span) {
		if (this.view.opt('selectHelper')) { // this setting signals that a mock helper event should be rendered

			// normally acceps an eventLocation, span has a start/end, which is good enough
			this.renderEventLocationHelper(span);
		}
		else {
			this.renderHighlight(span);
		}
	},


	// Unrenders any visual indication of a selection
	unrenderSelection: function() {
		this.unrenderHelper();
		this.unrenderHighlight();
	},


	/* Highlight
	------------------------------------------------------------------------------------------------------------------*/


	renderHighlight: function(span) {
		this.renderHighlightSegs(this.spanToSegs(span));
	},


	unrenderHighlight: function() {
		this.unrenderHighlightSegs();
	}

});
