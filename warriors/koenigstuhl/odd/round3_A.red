;redcode
;assert 1
;name Preventive Jab 
;author Dave Hillis
;strat -   Evolved LP warrior, edited by hand for contest.

div.ba } -7, * -7
jmp.ba }  7, *  1
djn.i  # -5, @    -4
spl.x  #   5, {  -7
djn.ba #   5, <  -7
djn.i  #  6, <   -7
djn.f  #    1, <  -5
spl.i  $    -3, >  -7
mov.i  # -2, $     1
end   7