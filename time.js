(function () {

  var AM = 'am'
    , PM = 'pm'
    , periodRegex = new RegExp('([ap](\\.?)(m\\.?)?)', 'i')
    , timeRegex = new RegExp('^(10|11|12|0?[1-9])(?::|\\.)?([0-5][0-9])?'
                             + periodRegex.source + '?$', 'i')
    , formatRegex = new RegExp('^(h|hh)([:|\.])?(mm)?( ?)'
                               + periodRegex.source + '?$', 'i');

  // play nice with both node.js and browser
  if (typeof module !== 'undefined' && module.exports) module.exports = Time;
  else window.Time = Time;

  /*
   * Time constructor works with(out) 'new'
   *
   * @time (optional) string or number representing a time.
   *   e.g. 7, 1234, '7', '7:00', '12.14'
   *
   *   If not provided, current time is used.
   */
  function Time(time) {
    if (!(this instanceof Time)) return new Time(time);

    var hours, minutes, period = null;

    if (time) {
      var result = timeRegex.exec(sanitize(time));
      if (result) {
        hours = parseInt(result[1], 10);
        minutes = result[2] ? parseInt(result[2], 10) : 0;
        period = parsePeriod(result[3]);
      }
    } else {
      // set to current time
      var d = new Date();
      hours = d.getHours();
      period = hours > 11 ? PM : AM;
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      minutes = d.getMinutes();
    }

    // gets or sets hours
    this.hours = function(newHours) {
      if (newHours === undefined) return hours;
      hours = parseInt(newHours, 10);
    };

    // gets or sets minutes
    this.minutes = function(newMinutes) {
      if (newMinutes === undefined) return minutes;
      minutes = parseInt(newMinutes, 10);
    };

    // gets or sets period
    this.period = function(newPeriod) {
      if (newPeriod === undefined) return period;
      period = parsePeriod(newPeriod);
    };
  }

  /*
   * Find the next immediate corresponding Date.
   *
   * Assume it's 3:15 pm Aug 10:
   * Time('3:15').nextDate() // 3:15 pm Aug 10
   * Time('415').nextDate()  // 4:15 pm Aug 10
   * Time('2').nextDate()    // 2:00 am Aug 11
   */
  Time.prototype.nextDate = function () {
    if (!this.isValid()) return null;

    var hours = this.hours() === 12 ? 0 : this.hours(); // uniformly handle am/pm adjustments
    if (this.period() === PM) hours += 12;
    var d = new Date();
    d.setHours(hours);
    d.setMinutes(this.minutes());
    d.setSeconds(0);
    d.setMilliseconds(0);

    // if it has already passed, add 12 hours at a time until it's in the future
    while (new Date() > d) d.setHours(d.getHours() + 12);

    // make sure we're in the correct period
    if (d.getHours() > 11 && this.period() === AM) d.setHours(d.getHours() + 12)
    else if (d.getHours() < 12 && this.period() === PM) d.setHours(d.getHours() + 12)

    return d;
  };

  /*  Returns time hours in 24 range
   *
   *  Parameters 
   *  ----------
   *  time  <Time>  
   *
   *  Return 
   *  ------
   *  <Integer> 	
   *
   *  Example
   *  -------
   *  hoursIn24Range(Time('8:30 pm'))  // 20
   *  hoursIn24Range(Time('2:00 am'))  // 2
   */ 

  function hoursIn24Range(time) {
    if (!(time instanceof Time)) return null;

    return (time.hours() === 12 ? 0 : time.hours()) + (time.period() === PM ? 12 : 0);
  }

  /*  Shifts time on some hours/minutes
   *
   *  Parameters
   *  ----------
   *  hours    <Integer|undefined>  Offset in hours
   *  minutes  <Integer|undefined>  Offset in minutes
   *
   *  Return 
   *  ------
   *  true if time was offseted successfuly or null if something went wrong.
   *
   *  Examples
   *  --------
   *  var t = Time('11:35 am');
   *
   *  t.offset(2, 15);    // 1:50 pm
   *  t.offset(-4, -10);  // 9:40 am
   */ 

  Time.prototype.shift = function (hours, minutes) {
    var sum_hours = null;
    var sum_minutes = null;

    if (!this.isValid()) return null;
    if (hours === undefined || minutes === undefined) return null;

    hours = parseInt(hours);
    minutes = parseInt(minutes);

    sum_hours = hoursIn24Range(this) + hours; 
    sum_minutes = this.minutes() + minutes;

    if (sum_minutes >= 60) {
      sum_hours++; 
      sum_minutes -= 60;
    }

    if (sum_hours >= 0 && sum_hours < 24) {
      this.hours(sum_hours % 12 == 0 ? 12 : sum_hours % 12);
      this.minutes(sum_minutes); 
      this.period(sum_hours > 11 ? PM : AM);
      return true;
    }
    else {
      return null;
    }
  };

  Time.isValid = function(time) {
    return timeRegex.test(sanitize(time));
  };

  Time.prototype.isValid = function() {
    return Time.isValid(toString(this));
  };

  /*
   * This can be safely changed if so desired.
   */
  Time.DEFAULT_TIME_FORMAT = 'h:mm am';

  /*
   * Formats the time to the given format, or h:mm if one is not provided.
   *
   * If periods are specified in the format, they are only printed if known.
   *
   * If the time isn't valid, return 'invalid time'.
   * If the format isn't valid, return 'invalid format'.
   *
   * This isn't every combination, but hopefully you get the gist of things.
   * h:mm       12:00       (default)
   * hh:mm      01:00
   * h          1
   * h          1:55        (input specified minutes, so we show them)
   * h.         1.55        (if minutes are shown, use . for separator)
   * hpm        1am
   * h:mm a     1:55 p
   * h:mm a     1:55        (input didn't specify period)
   * h.mm am    1.55 pm
   * h.mm A     1.55 P
   * hh:mm a.m. 01:55 a.m.
   * h:mma      1:55a
   * h.mm       1.55
   */
  Time.prototype.format = function(format) {
    format = format || Time.DEFAULT_TIME_FORMAT;
    if (!this.isValid()) {
      return 'invalid time';
    } else if (!formatRegex.test(format)) {
      return 'invalid format';
    }
    return toString(this, format);
  };

  /*
   * Alias for `format`.
   */
  Time.prototype.toString = Time.prototype.format;

  /*
   * (private) Format Time in the given format.
   *
   * @time Time instance
   * @retun hh:mm e.g. 3:00, 12:23, undefined:undefined
   */
  function toString(time, format) {
    format = format || Time.DEFAULT_TIME_FORMAT;
    var bits = formatRegex.exec(format);
    var fHour = bits[1];
    var fMiddlebit = bits[2];
    var fMinutes = bits[3];
    var fPeriodSpace = bits[4];
    var fPeriod = bits[5];
    var fFirstPeriod = bits[6];
    var fPeriodM = bits[7];

    // always show hour
    var hours = fHour.length == 2 ? padTime(time.hours()) : time.hours();

    // show if in the format or if non-zero and middlebit is provided
    var minutes = (fMinutes || (fMiddlebit && time.minutes() !== 0)) ?
                    padTime(time.minutes()) : '';

    // show middlebit if we have minutes
    var middlebit = (minutes && fMiddlebit) ? fMiddlebit : '';

    // show period if available and requested
    var period = '';
    if (fPeriod && time.period()) {
      var firstPeriod = time.period().charAt(0);
      if (fPeriod.charAt(0) === fPeriod.charAt(0).toUpperCase()) {
        firstPeriod = firstPeriod.toUpperCase();
      }
      period = firstPeriod + fPeriod.slice(1);
    }

    // only show space if it was requested by format and there's a period
    var space = (period && fPeriodSpace) ? fPeriodSpace : '';

    return '' + hours + middlebit + minutes + space + period;
  }

  function padTime(time) {
    return time < 10 ? '0' + time : time;
  }

  /*
   * (private) Force @time to a string and remove all whitespace.
   *
   * @time input
   * @retun input as a string, with all white space removed
   */
  function sanitize(time) {
    return time.toString().replace(/\s/g, '');
  }

  /*
   * (private)
   */
  function parsePeriod(period) {
    if (!period || !period.match(periodRegex)) return null;
    else if (period.match(/^p/i) != null) return PM;
    return (period.match(/^a/i) != null) ? AM : null;
  }
})();
