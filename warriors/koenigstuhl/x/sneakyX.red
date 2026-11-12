;redcode-94x
;author Christian Schmidt
;name Sneaky X
;strategy Self-Replicating Stone/scanner
;strategy more anti-imp and brainwash
;assert 1

xxx equ 13359

sLen   equ 36
sOff1  equ 2390+xxx
sOff2  equ 24228+xxx
sStep1 equ 41876
sStep2 equ 6986
sAwa   equ 52946



sStart  mov     #sLen,   #sLen
sGo     add.f   sTab,    sScan
sScan   mov.i   }sOff1,  sOff2
        jmz.f   -2,      {sScan
        mov.i   iBmb,    }sScan
        mov     <sStart, {to
        jmn     -2,      sStart
        spl     >sStart, }-200
to      jmz     sAwa,    *0
sTab    dat     <sStep1, >sStep2
iBmb    dat     <2667,   <5334

for 16
        dat     0,       0
rof

for 4
        stp.ab  >0,      #0
rof

end sScan

