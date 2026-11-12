;redcode-DS
;name Pieface
;author PhilB
;strategy One-Shot Scanner with S/S/D clear.
;strategy (LuckyLuke)
;assert 1
;kill Pieface

ptr EQU (sptr-21)

;clean like Geist
bptr: dat 1, 2+7+(bptr-ptr)
jbmb:
dptr: spl #ptr+450, 2+7+(bptr-ptr)
dat 0, 0
clr: spl #125, }ptr
mov *bptr, >ptr
mov *bptr, >ptr
djn.f -2, }dptr 

for 6
dat 0, 0
rof

;find like LuckyLuke
MA EQU ( 581 )
MB EQU ( 73 )

scan: mul.ab #MA, sptr
jmz.f scan, @sptr ;>sptr is nice with diff contants
sptr: spl clr, MB
mov.b sptr, ptr
mov.i jbmb, @sptr

dat 0, 0

isnigh: jmp scan, <sptr+2933

end isnigh


