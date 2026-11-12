;redcode
;name Genetic Beef
;author M Joonas Pihlaja
;strategy clear with strip bombing
;assert 1

 spl.f  0, 0		; Wait for oneshots to pass us and gather up some
 spl.f  0, 0		;  vital processes for later.
 spl.f  0, 0
 spl.f  0, 0
 spl.f  0, 0
 sub.f <0,>0		; These early addressing modes try to sub whatever
 sub.f *0,>0		;  the enemy clears us with to yield spl 0,0's.
 spl.f  0,{0		;  Very necessary against backward (+forwd.) clears
 sub.f }0,<0		;  that catch us early.  The repair doesn't work
 sub.x >0,{0		;  too well though (too many .x's?).
 sub.f }0,{0
 sub.x }0,>0
 sub.f >0,<0
 sub.f }0,>0
 sub.x {0,>0
 sub.x  0,}0
 spl.x {0,>0
 sub.f <0,>0
 spl.f >0,}0		; A final concentrated effort to jump ship.
 spl.x <0,{0

end

