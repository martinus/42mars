;redcode
;name Sneaky TNX
;author Christian Schmidt
;assert 1
;strategy Sneaky B clone for the Tournament

;-------Constants for Tiny-----------
for CORESIZE==800
sDec1  equ 285
sDec2  equ sStart+103
sLen   equ 13
sOff1  equ 321
sOff2  equ 226
sStep1 equ 393
sStep2 equ 751
sTrail equ 778
sAwa   equ 360
rof
;-------Constants for Tiny-----------

;-------Constants for 94nop----------
for CORESIZE==8000
sDec1   equ    -12
sDec2   equ    sStart+214
sLen   equ 21
sOff1  equ 219
sOff2  equ 7771
sStep1 equ 3431
sStep2 equ 3916
sTrail equ -200
sAwa   equ 2543
rof
;-------Constants for 94nop----------

;-------Constants for 94x------------
for CORESIZE==55440
sDec1   equ    -12
sDec2   equ    sStart+214
sLen   equ 36
sOff1  equ 2390
sOff2  equ 24228
sStep1 equ 41876
sStep2 equ 6986
sTrail equ -200
sAwa   equ 52946
rof
;-------Constants for 94x------------

;-------Sneaky B code----------------
sStart  mov     #sLen,   #sLen
sGo     add.f   sTab,    sScan
sScan   mov.i   }sOff1,  sOff2
        jmz.f   -2,      {sScan
        mov.i   sTab,    }sScan
        mov     <sStart, {to
        jmn     -2,      sStart
        spl     >sStart, }sTrail
to      jmz     sAwa,    *0
sTab    dat     <sStep1, >sStep2
        for    8
        dat    0,0
        rof
;-------Sneaky B code----------------

;-------Decoymaker-------------------
sCnt
z       for    6
        mov    <sDec2+sDec1*z, {sDec2+sDec1*z+sDec1-1
        rof
        djn.f  sScan,      <sDec2+sDec1*8
;-------Decoymaker-------------------

end     sCnt
