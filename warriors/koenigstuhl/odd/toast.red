;redcode
;name toast
;author Dave Hillis
;strat -   Created using RedRace.c.
;strat -   KOFACOTO Round 1.
;strat -   The scanner from "Electric Head" by Anton Marsden
;strat -   scores twice as high as this thing (sigh).
;assert CORESIZE == 8000
spl.ab $     0, {    -1
spl.a  #    -2, *    -2
mul.i  >    -2, $   -22
div.a  #    -4, #     0
spl.i  *     2, *     7
mov.i  *     0, $    -6
spl.i  #     5, @    -1
spl.b  @    -8, @    -9
spl.i  @    -3, @    -9
spl.f  >    -3, @   -11
add.ba *    -5, <   -16
mul.i  >    -6, <   -22
spl.i  >    -2, *    -3
seq.ab }     9, <   -15
div.i  #    -3, #     0
spl.i  #    -3, *   -10
spl.i  >  1342, $     5
spl.i  $   -19, >    -2
spl.x  #   -11, {     4
jmz.ab @   -16, >    -4
add.i  {     2, {    -4
spl.f  >    -2, @    -9
spl.f  >     2, @     0
end   0 

