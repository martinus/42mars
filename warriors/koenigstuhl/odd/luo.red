;redcode-rf20
;name Luo
;author G.Labarga
;assert CORESIZE==8000
;strategy Oneshot scanner
;strategy Booted as fast as possible
;strategy Tweaked to headache

; ========================
; original Pool C - 25 Instructions
; ========================
; Just to compare
;PC00   spl    @    3077 , #       2
;PC01   spl    $      -3 , #       3
;PC02   mov.i  >      -1 , }      -1
;PC03   mov.i  }      22 , >       5
;PC04   dat    <    2667 , <    5334
;PC05   mov.ab #       0 , >       7
;PC06   sne.i  $    3044 , $    3364
;PC07   sne.x  $      20 , $      11
;PC08   seq.f  *    1143 , *      13
;PC09   seq.b  $    1203 , <      17
;PC10   mov.i  $    2376 , $      -7
;PC11   mov.ab $       4 , @      19
;PC12   jmz.f  $       1 , $      23
;PC13   djn.x  $    1111 , <      29
;PC14   djn.a  $      -4 , #    1000
;PC15   spl    #      12 , #      31
;PC16   add.ba #    2365 , $      -3
;PC17   add.x  $       0 , $      37
;PC18   slt.a  $     889 , $ (joker)
;PC19   jmp    $   -2667 , $      41
;PC20   mul.ab #      -8 , $      43
;PC21   mov.i  #    3315 , *      47
;PC22   mov.i  #      -1 , $      53
;PC23   spl    $ (joker) , <    2936
;PC24   jmn    $      -2 , @      59

; ========================
; Pool C - 25 Instructions
; ========================

PC00   spl    @    3077 , #       2
PC01   spl    $      -3 , #       3
PC02   mov.i  >      -1 , }      -1
PC03   mov.i  @      22 , >       5	;Addressing changed: 4 AP
PC04   dat    <    2667 , <    5334
PC05   mov.ab #       0 , >       7
PC06   sne.i  $    3044 , $    3364
PC07   sne.x  $      20 , $      11	;<- here starts the warrior!
PC08   seq.f  *    1143 , *      13
PC09   seq.b  $    1203 , <      17
PC10   mov.i  $    2376 , $      -7
PC11   mov.ab $       4 , @      19
PC12   jmz.f  $       1 , $      23
PC13   djn.x  $    1111 , {      29	;Addressing changed: 4 AP
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31	;<- here ends the warrior!
PC16   add.ba #    2365 , $      -3
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $ -3		;(B-joker=-3)
PC19   jmp    $   -2667 , $      41
PC20   mul.ab #      -8 , $      43
PC21   mov.i  #    3315 , *      47
PC22   mov.i  #      -1 , $      53
PC23   spl    $    36+7 , <    2936	;(A-joker=43)
PC24   jmn    $      -2 , @      59

for 18
	dat 0,0
rof
start:	mov.x *PC23,PC15
	mov.i PC04,*go	;dat <,<
	mov.a PC20,*go
	mov.b @PC18,*go	;written B=8
	;(djn.x $,{)
	mov.x @PC20,{go		;<- (-2,2)
	mov.i PC03,{go	;mov.i @,>
	mov.f @PC21,*go		;<- (-4,1)
	mov.i @PC05,{go ;(mov.i @,>)
hcl:	sub.f @PC00,*go
	mov.i @PC18,{go	;spl #,#
	mov.f @PC24,*go
mcl:	mov.i @PC16,{go	;djn.x $,{
	sub.b PC06,*go
	mov.i PC06,{go	;sne.i $,$
	;mov.x PC05,*go5
	mov.f <PC24,*go
	mov.i PC17,{go	;add.x $,$
	mov.ba PC01,*go
	mov.ab @PC05,*go

wipe:	mov.i go+1,{hcl2	;crazy wipe :-S
	spl 0,}0
ref:	spl 2,-2
hcl2:	mov.i *PC07,}mcl
	mov.i go+1,{hcl2
	mov.i go+2,}mcl
	mov.i *mcl+7,{0
	spl 1,-4
	mov.i *start,}0		
	mov.i go+1,>1
	jmn.b -1,wipe			;unwipped: 1AP
go:	jmp PC14,{0
for 9
	dat 0,0
rof
	dat 2+1,9+1			;unwipped: 1AP
	dat (7*19*2),(7*19*2)		;unwipped: 1AP
end start

;------- AP cost: 11 ---------

;should create something like this:
;add.x $3,$1
;sne.i $7,$0
;djn.x $-2,{5144
;spl #889,#889
;mov.i @2,>-3
;mov.i @1,>-4
;djn.x $-2,{2
;dat <-8..,7
;spl #-...,8

;The warrior is created in the middle of the pool.




