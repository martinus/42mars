;redcode-94
;name dumb scan
;author David Houston
;       CORESIZE == 2520
;assert 1

startA equ -20
startB equ -30
step equ -20
stream equ -10

org ptr

add.f inc, ptr
ptr: sne startA, startB
djn.f -2, stream
mov.ab ptr, wipe
inc: spl #step, <step
mov *wipe, <wipe
djn.f -1, inc + step
dat -2, -6
spl #-2, -6
wipe: dat -1, ptr - 37
