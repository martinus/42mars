;name Res-Q
;author LAchi
;strategy 1. Find the Little Sibling
;strategy 2. Move its process to perform a spl-bomb
;strategy 3. Scan for the Bully
;strategy 4. dat coreclear
;assert 1

LSTEP  equ -101
LFIRST equ 1000
LCOUNT equ 799

SFIRST equ 100
SWIDTH equ 10
SSTEP  equ 32
STIMES equ 400

	org lstart

; [ FIND THE LITTLE SIBLING ]

lsteps
	jmp     LSTEP-2,  LSTEP
lvamp
	jmp     sbomb-little

;the Little Sibling leaves some garbage every 2 location
;starting 1601 locations away from the start

;need to lose one step so to allow the Little Sibling
;to perform the first operation if it starts before;
;if the Little Brother starts before, we vamp the jmp
;else we vamp the sub.x instruction
lstart
	sub.x   lsteps,   little
little
	seq.i   LFIRST,   LFIRST+1601-1
	jmp     lcont
	djn.b   lstart,  #LCOUNT

;now suppose that the Little Sibling is at the
;a-field of little: move its process to the spl-bombing
;routine
lcont
	sub.a   little,   lvamp
	mov.i   lvamp,   *little
	jmp     bscan

; [ SPL BOMB ROUTINE ]

;this is executed by the process of the Little Brother
;my process will keep on feeding the
;bptr b-field;
;the 2 warriors work together now
;so this is actually a .66c bomber
bptr
	spl    #0,        SFIRST-SSTEP
sbomb
	mov     bstun,   >bptr
;I know there is no need for this, anyway I like
;this trick ;)
	jmp    {0,       }0

; [ SCAN FOR THE BULLY ]

;this scans for the bully and feeds its sibling's
;bomb pointer
;the 2 warriors work together now
;so this is actually a .88c scanner

bstart
	add.f   ssteps,   bscan
bscan
	seq.i   SFIRST,   SFIRST+SWIDTH
	mov.ab  bscan,    bptr
	djn.b   bstart,  #STIMES

; [ DAT CORECLEAR ]

;increment a-field of sbomb and go to bptr
	jmp     bptr,    }sbomb

ssteps
	dat     SSTEP,    SSTEP
bstun
	spl    #0,        datz-bptr
	dat    #0,        datz-bptr

datz
	end

