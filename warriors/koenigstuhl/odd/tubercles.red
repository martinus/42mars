;redcode-rf20
;name Tubercles
;author Zul Nadzri
;strategy Absolute anti-scanner
;assert 1

; ========================
; Pool A - 10 Instructions
; ========================
PA00   spl    $  199 , #   17
PA01   jmp    @   11 , }   47
PA02   mov.i  *   -3 , }   -3
PA03   mul.ab #  367 , $    0
PA04   spl    @  -10 , #   10
PA05   mov.i  > 2667 , }   -5
PA06   mov.i  { 1143 , $   -2
PA07   mod.f  $   -1 , $   16
PA08   sne.b  $   22 , $ 3044
PA09   sub.x  #    0 , $ 2365		
;----------------------------------
;change addressing mode PA06 : 4 AP
;change modifier PA09 : 3 AP
;flip addressing mode PA09 : 2 AP
;change addressing mode PA01 : 4 AP
;total 13 AP 

;------------------moving codes -----------
tgt equ PA00
L1	mov.i PA06, tgt
	add.a PA03, @L1
	add.ba PA01, @L1
	add.ba PA01, @L1
	add.ba PA02, @L1
	add.b PA08, @L1
	sub.b PA05, @L1

L3	mov.i PA01, tgt+2
	sub.f PA01, @L3
	add.b PA06, @L3

L2	mov.i PA09, tgt+1
	sub.ba PA08, @L2
	add.ba PA06, @L2
	mov.ab PA07, @L2

;-------------------deleting codes------------
spl ax
spl 1
spl 1
spl 1
core equ 300
a1	mov core, >exit
	mov core, >exit
	mov core, >exit
	mov core, >exit
	mov core, >exit
ax	mov core, 0
	mov core, 0
	mov core, 0
	mov core, 0
	mov core, 0
	mov core, 0
	mov core, 0
exit	jmp PA00, PA03

end L1
