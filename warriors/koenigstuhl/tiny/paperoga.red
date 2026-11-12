;redcode-tiny
;assert CORESIZE==800
;name Paperoga
;author Stefano Priore
;strategy Paper
;*** Created using Stupid paper generator v0.1
;*** The choice of loosers :P

ploc1 equ (5-795)
ploc2 equ (5-795)
bloc2 equ (5-795)
dloc1 equ (5-795)

ORG lch
lch:	spl   2
spl   1
spl   1
pair1:	spl   @0,<ploc1
mov.i }pair1,>pair1
mov.i bomb1,{bloc2
mov.i {pair1,{pair2
pair2:	djn.f *ploc2,{dloc1
bomb1:	mov.i #1,{1
END

