;redcode
;assert CORESIZE==8000
;name Plagarismo 2
;author Zul Nadzri
;strategy I confess, 88 is not my favourite yet.
; update v5: using different warrior components.
; update v6: switch vm5 to tangle trap. shortened pspace.
; update v6b: rearrange pspace.
; update v6c: add bwash test.

;----------------------- Dumb Switch -----------------------
song		ldp #301, 1		;get brainwash
		cmp #55, #0		;compare with pword
		jmp goto		;brainwashed		

switch	ldp #0, war1		;get result
lastwar	ldp #300, warx		;load last warrior
tester	slt #0, war1		;compare
lose		add #1, warx		;next warrior
wintie	slt warx, #4		;limit to 3 warriors
		sub #3, warx		;adjust extra

goto		stp warx, #300		;confirm won, save warrior
		stp #55, #301
warx		jmp @0, 3
war1		jmp main, 0
war2		jmp boot8
;war3		jmp main

;----------------------- Quick Silver -----------------------
sdist equ 4857
dboff equ 11
idist equ 7706
ioff  equ 5817

boot  mov imp5+1         , sdist+dboff
iboot spl 2             , boot+idist+3
      spl 1             , boot+ioff+3
      mov imp5           , <-1
      mov <stone5        , <iboot
      mov -3            , 0
      mov <stone5        , <sboot
      djn boot+sdist    , #5
sboot djn boot+idist    , #boot+sdist+5

stone5 spl 0             , imp5
      mov stone5+dboff   , <-123
      mov stone5+dboff   , @-1
      add #-107         , -2
      djn -3            , <5246

      spl 0             , 0
      add #2668         , 1
      jmp @0            , ioff-idist-2670

imp5   mov 0             , 2667
      dat <1            , #17

;----------------------- Tangle Trap -----------------------
step equ -49
skip equ -18
time equ 976

dist   equ 5098  ; distance to vamp_A from boot
distCh equ 45    ; distance to check from vamp_A
distT  equ 217   ; distance to trap from vamp_A
distCl equ (-41) ; distance to clear from vamp_A

boot2   mov clBomb, @pCl
        mov fang2, @pF
        mov fang1, <pF
pW      mov wimp, boot8+dist+(vamp_C-vamp_A)+skip+step
pT      spl pC, boot8+dist+distT+3
pF      spl boot8+dist+2, boot8+dist+distCh
pV      spl @0, boot8+dist+6
        mov <pV,  pF   ; hide boot pointers
        dat <pT, <pW

pC      spl boot8+dist+3, boot8+dist+distCl+3
pV2     spl @0, boot8+dist+1
        mov <pV2,  pC    ; hide boot pointers
        dat <pV2, <boot8+dist+3858

boot8    spl boot2, <boot8+dist+3466
        spl 2,     <boot8+dist+1555
        spl 1,     <boot8+dist+2290
        mov <source, <pV
        mov <source, <pV
        mov <source, <pC
        mov <source, <pT
        djn @pV2, #3
pCl     djn @pV,  #boot8+dist+distCl-4

wimp    jmp 0, <0
clBomb  dat <-8, #-10

fang1   jmp skip + step, skip
fang2   jmp distT-(vamp_C-vamp_A)+(step*time)-skip-step, 2

        spl  0, <2
source  spl -1,  vamp_A + 6
        jmn -1, #MAXPROCESSES

        spl  0, <-7
        mov -5, <-5
        djn -1, <3984

check  equ (vamp_A + distCh)
clear  equ (vamp_A + distCl)

vamp_A  add   vamp_B,  check
vamp_B  sub  #-step,   2
vamp_C  mov  <check,  @vamp_D
vamp_D  mov  <check,  @vamp_C - step * time
vamp_E  jmz   vamp_A,  check
        jmp   clear,   0

;----------------------- Freight Train -----------------------
stbd   equ  1500  ; stone
c1bd   equ  2004  ; continuous launcher #1
c2bd   equ  6508  ; continuous launcher #2
is equ ((CORESIZE+1)/7)
step2   equ    82  ; bombing step size
time2   equ  2437  ; number of bombs dropped before starting clear
dd     equ     7  ; position of special bomb relative to stone
QB equ 1748
QS equ  328
QI equ  163

cont   spl      0,  0
       add  #1+is,  1
       jmp     @0,  cont-c1bd+(imp-main)+(6*is)

main   spl launch,stone+4
       spl 1,cont+3
       spl 1,cont+3
       mov <-3, <stptr
       mov <-3, <c1ptr
       mov <-3, <c2ptr
stptr  djn main+stbd+1, #main+stbd+4

cboot  mov imp, imp-is
       mov db, main+stbd+dd
c1ptr  spl main+c1bd, main+c1bd+3
       mov #-2-c2bd+(imp-main)+(6*is)+2, main+c2bd+2
       jmp main+c2bd, <0

db     dat <2667,  <1

imp    mov 0, is

stone  mov <dd+1+(2*time2), 3+(step2*time2)
       spl  -1, <2-step2
       add   1,   -2
       djn  -2, <0-step2   ; gets bombed with db to start core clear

launch spl cboot,QS*5
qt1    spl 1,QS*1
qt3    spl 1,QS*3
c2ptr  spl 1,main+c2bd+3
       spl 2,0
       jmp @0, imp-is
       add #is, -1
last   jmp main+stbd+1, <0

;	 end switch
end song
;end main
