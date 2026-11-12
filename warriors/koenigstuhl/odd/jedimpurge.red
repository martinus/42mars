;redcode-94
;name JedimPURGE
;author David Moore
;strategy Plant a decoy to distract the quickscan.
;strategy Scan for boot code and booby trap it.
;strategy Stun the silk/imp thing.
;strategy Wipe up the leftovers with a spiral clear.
;assert 1

first  equ  151
step   equ  110
diff   equ   55

top    dat    step,  step
       add.f   top,  scan
scan   sne  first+diff, first ;coarse scan for Jedimp boot code
       add.f   top,  scan
       jmn.f tweak, @scan
       jmz.f    -4, *scan
       mov.x  scan,  scan

tweak  jmn.f    #0, <scan  ; determine precise location
       add.ab   #92, scan
       mov     top, @scan  ; kill the bootstrap code
       add.ab #1313, scan
       mov    stun, >scan  ; overwrite silk with spl #0
       djn.b    -1, #8
       mov.ab   #8, -1
       add.ab #1743, scan  ; move to next copy if there is one
       jmn.f    -4, @scan

; spiral clear just in case Jedimp actually makes an imp

       add.b stun, 4 ; this is hit by SPL to start DAT clear
       mov  * -1, <3
       jmp    -2,  0
stun   spl    #4, 1144

;---------------------------------------------------------------------
;Jedimp's q^2 doesn't bomb more than 36 spaces before the scanned cell

       for 36
       dat 0,0
       rof

;---------------------------------------------------------------------
;decoy

decoy  mov < (top- 300) + 0, < (top- 300) + 2
       mov < (top- 300) + 1, < (top- 300) + 4
       mov < (top- 300) + 5, < (top- 300) + 7
       mov < (top- 300) + 8, < (top- 300) +10
       mov < (top- 300) +11, < (top- 300) +13
       mov < (top- 300) +14, < (top- 300) +16
       spl             scan, < (top- 300) +17
       djn.f          extra, < (top- 300) +19

;---------------------------------------------------------------------
; free scans, why not?

base equ 155

j for 9
quik&j mov.f 1, scan
data&j dat diff+top-base-step*j+scan+1, top-base-step*j+scan
rof

extra
i for 9
       seq diff+top-base-step*(i-1), top-base-step*(i-1)
       djn.a quik&i, data&i  ; branch not taken if data got hit
rof

for MAXLENGTH-CURLINE
       dat 1,1
rof

end decoy 

