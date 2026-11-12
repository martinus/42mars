;redcode-94x 
;name Sneaky X improved kvdp
;author Christian Schmidt/Steve Gunnell
;strategy Self-Replicating Stone/scanner 
;strategy couldn't stand it loosing 20% against jmp #1, #1 
;strategy Improving bomb, constants and other bits. 
;assert CORESIZE==55440 

sOff1  equ 2142 
sOff2  equ 42148 
sStep1 equ 44865 
sStep2 equ 13806 
sAwa   equ 12275 
sLen   equ (sTop-sStart+19) 
IMPNUM equ 50093 

sStart  mov     #sLen,   #sLen 
sGo     add.f   sTab,    sScan 
sScan   mov.i   {sOff1,  sOff2 
        jmz.f   -2,      {sScan 
        mov.i   iBmb,    }sScan 
        mov     <sStart, {to 
        jmn     -2,      sStart 
        spl     >sStart, }-430 
to      jmz     sAwa,    *0 
sTab    dat     <sStep1, >sStep2 
iBmb    mod.f >0, <0 

for 17 
        dat.f   $0,       $0 
rof 

for 15 
        stp.ab  >0,      #0 
rof 
sTop    dat.f   $0,       $0 

end sScan

