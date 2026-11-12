;redcode-94x
;name Sneaky X improved 1463
;author Christian Schmidt/Steve Gunnell
;strategy Self-Replicating Stone/scanner
;strategy couldn't stand it loosing 20% against jmp #1, #1
;strategy Improving bomb, constants and other bits.
;assert CORESIZE==55440

sOff1  equ 36762
sOff2  equ 26106
sStep1 equ 41411
sStep2 equ 13591
sAwa   equ 27432
sLen   equ (sTop-sStart+8)
IMPNUM equ 30901

sStart  mov     #sLen,   #sLen
sGo     add.f   sTab,    sScan
sScan   mov.i   {sOff1, }sOff2
        jmz.f   -2,      {sScan
        mov.i   iBmb,    }sScan
        mov     <sStart, {to
        jmn     -2,      sStart
        spl     >sStart, }-277
to      jmz     sAwa,    *0
sTab    dat     <sStep1, >sStep2
iBmb    dat >IMPNUM+IMPNUM, >IMPNUM

for 12
        dat.f   $0,       $0
rof

for 18
        stp.ab  >0,      #0
rof
sTop    dat.f   $0,       $0

end sScan
