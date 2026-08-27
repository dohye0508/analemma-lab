core.resetOutput();

var planets = [
    {name:"Mercury", solarDayHours:4224,  orbitDays:176,   solsPerStep:0.02},
    {name:"Venus",   solarDayHours:2802,  orbitDays:225,   solsPerStep:0.04},
    {name:"Earth",   solarDayHours:24,    orbitDays:365,   solsPerStep:5},
    {name:"Mars",    solarDayHours:24.66, orbitDays:687,   solsPerStep:10},
    {name:"Jupiter", solarDayHours:9.93,  orbitDays:4333,  solsPerStep:50},
    {name:"Saturn",  solarDayHours:10.55, orbitDays:10759, solsPerStep:200},
    {name:"Uranus",  solarDayHours:17.24, orbitDays:30687, solsPerStep:400},
    {name:"Neptune", solarDayHours:16.11, orbitDays:60190, solsPerStep:800}
];

for (var idx = 0; idx < planets.length; idx++) {
    var p = planets[idx];
    var stepHours = p.solsPerStep * p.solarDayHours;
    var points = Math.ceil((p.orbitDays * 24) / stepHours);

    core.resetOutput();

    // duration=0 so the observer snaps instantly instead of animating over 1s
    core.setObserverLocation(0, 30, 0, 0, "", p.name);
    core.wait(0.3);

    core.setDate("2026-01-01T12:00:00", "UTC");
    core.wait(0.3);
    core.selectObjectByName("Sun", false);

    // throwaway warm-up reads so the horizontal-coordinate cache is fresh
    // before we start recording real data points
    core.getObjectInfo("Sun");
    core.wait(0.2);
    core.getObjectInfo("Sun");
    core.wait(0.2);

    core.output("planet=" + p.name);
    core.output("step,azimuth,altitude");

    for (i = 0; i < points; i++) {
        var info = core.getObjectInfo("Sun");
        core.output(i + "," + info.azimuth + "," + info.altitude);
        core.setDate("+" + stepHours + " hours");
        core.wait(0.15);
    }

    core.saveOutputAs("analemma_" + p.name + ".txt");
}

core.output("DONE");
