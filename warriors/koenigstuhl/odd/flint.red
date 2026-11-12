;redcode-94nop
;name flint
;author simon wainwright
;strategy stone clear
;assert 1
st equ 335
cr equ pkin+CORESIZE/11
inc spl #-st,<st
pkin mov >st,1-st
sub inc, pkin
mov bomb, }bomb
djn.f pkin, }bomb
bomb dat cr,1
dat -9

