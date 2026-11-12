;redcode-rf20
;name Junkyard Guy
;author Zul Nadzri
;strategy Cheap silk + unpolished stone
;strategy Well, what to expect during emergency like this? :)
;assert CORESIZE==8000

; ========================
; Pool C - 25 Instructions
; ========================

PC00   spl    @    3077 , #       2
PC01   spl    $      -3 , #       3
PC02   mov.i  {      -1 , <      -1
PC03   mov.i  }      22 , >       5
PC04   dat    <    2667 , <    5334
PC05   mov.ab #       0 , >       7
PC06   sne.i  $    3044 , $    3364
PC07   sne.x  $      20 , $      11
PC08   jmn.f  @    1143 , *      13
PC09   seq.b  $    1203 , <      17
PC10   mov.i  $    2376 , $      -7
PC11   mov.ab $       4 , @      19
PC12   jmz.f  $       1 , $      23
PC13   djn.x  $    1111 , <      29
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31
PC16   add.ba #    2365 , $      -3
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $   -2276    ;joker-b
PC19   jmp    $   -2667 , $      41
PC20   mul.ab #      -8 , $      43
PC21   mov.i  #    3315 , *      47
PC22   mov.i  #      -1 , $      53
PC23   spl    $    -483 , <    2936    ;joker-a
PC24   seq    $      -2 , @      59
;------------------------------------------
;change both PC02 addressing mode : 8 AP
;swap instructions between PC24 and PC8 : 3 AP
;flip addressing mode PC8 from * to@ : 2 AP
;total AP = 8 + 3 + 2 = 13 AP
;balance AP = 2 AP

;--------- Setting constants + move
tgt1 equ PC00
adj2 equ 1
tgt2 equ PC00+480+adj2

start mov PC00, tgt2			;top
	sub.f PC00, @start
	add.ab PC10, @start

L2	mov PC03, tgt2+1
	mov.x PC02, @L2

L2a	mov PC23, tgt2-2
	sub.a PC14, @L2a
	mov PC22, tgt2-1

L3	mov PC02, tgt2+2
	add.a PC02, @L3
	mul.ab PC02, @L3

L4	mov PC08, tgt2+3			;bottom
	sub.a PC08, @L4
	add.ab PC13, @L4

L6	mov PC21, tgt1+1
	mov.ba PC03, @L6
	mov.b PC00, @L6

L8	mov PC10, tgt1+3
	sub.a PC00, @L8
L8a	sub.a PC04, @L8
	add.ba PC12, @L8 
	mov.ab PC23, @L8

L10	mov PC04, tgt1+5  ;free

L11	mov PC04, tgt1+6
	div.f PC04, @L11

L5	mov PC15, tgt1
	mov.ba PC18, @L5
	mov.b PC18, @L5	

L7	mov PC17, tgt1+2
	mov.a PC24, @L7
	mov.ab PC12, @L7 

L9 	mov PC19, tgt1+4
	mov.ba PC16, @L9
	mov.ab PC14, @L9

;--------- Deleting Codes
L1 equ 300
Z1	spl 2
	spl 1
	spl 1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
	mov.i L1, >a1
a1	jmp.a 365+a1-L3+adj2, PC07

end start