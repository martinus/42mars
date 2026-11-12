;redcode
;assert CORESIZE == 8000
;name rdrc: Drowsy Decay
;author Dave Hillis
;strategy -   Created using RedRace for the Halloween 2014 Contest.
;strategy -   Evolved paper. 
;strategy -   Weak replicator: only makes a few copies.
;strategy -   Irregular-pattern spl-bombing, early.
;strategy -   Morphs into core-clears and D-Clearish things.
;strategy -   A sole D-Clearish thing remains at the end.
;
mov.i  $   407, <   -98
spl.x  # -2853, $ -1368 ; incendiary bomb + self-split
mov.i  }    -8, }     2 ; replicating copy
mov.i  $    -2, {  3045 ; throw incendiary
spl.ba $ -3502, <  -180 ; split to copy
mov.i  $    -4, <    -2 ; throw incendiary
mov.i  $   -12, }    -5 ; D-Clearish thing
djn.f  $    -1, }    -6 ; D-Clearish thing
end   1
