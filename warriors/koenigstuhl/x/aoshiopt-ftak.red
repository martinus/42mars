;redcode-94x
;name Aoshi A 20
;author Steve Gunnell
;strategy Fast f-scanner.
;assert 1

STEP equ 33230
GAP1 equ 17
GAP2 equ 7
BPTR equ (top-7)
SPAN equ 22935
TIME equ 23137
IMPNUM equ 21139

top  dat    #0    ,SPAN
for GAP1
     dat.f  $0     ,$0
rof
sptr mov.b  top   ,BPTR
wipe mov.i  bomb  ,>BPTR
for GAP2
     mov.i  *wipe ,>BPTR
rof
     jmn.f  wipe  ,@BPTR
scan add.f  incr  ,@tptr
     jmn.f  safe  ,@top
tptr jmz.f  scan  ,*top
     mov.x  @tptr ,@tptr
safe slt.b  @tptr ,#tail-top+3
     jmp    sptr
     djn.b  scan  ,#TIME
     jmp    scan  ,}wipe
incr dat    STEP  ,STEP
bomb jmp  0, }0
tail mov.i #1, {1
end scan

