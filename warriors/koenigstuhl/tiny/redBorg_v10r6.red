; -*-asm-*-
; This program was automagically created by uGP (MicroGP v2.1r10.3 [beta])
; Copyright (c) 2002-2004 by Giovanni Squillero <giovanni.squillero@polito.it>
; 

;redcode-tiny
;name RedBorg v1.0r6
;author The MicroGP Corewars Collective
;url http://www.cad.polito.it/research/microgp.html
;strategy - Biological and technological distinctiveness
;strategy - of existing warriors was added to our own.
;strategy - Existing strategies were adapted to serve us.
;strategy - Resistance is futile.
;strategy - We are the RedBorg.
;
;strategy - The MicroGP Corewars Collective:
;strategy -      Bio
;strategy -      (ES)^2
;strategy -      Dr.Gapp
;strategy -      Ipso
;strategy -      MadMax
;strategy -      PPU
;
;note - 149/199:04:25
;assert CORESIZE == 800

	org n3977706
n3977701:
	djn.f $n3977701+406, <n3977704+721
	dat $0, $0
	dat $0, $0
n3977704:
	dat $0, $0
n3977705:
	sub.i $n3977709+0, $n3977707+0
n3977706:
	mov.i $n3977716+0, @n3977707+0
n3977707:
	sne.a $n3977707+54, {n3977707+36
	djn.f $n3977705+0, {n3977717+721
n3977709:
	spl #n3977709+774, <n3977709+774
	mov.i @n3977713+0, >n3977707+0
n3977711:
	mov.i @n3977713+0, >n3977707+0
n3977712:
	mov.i @n3977713+0, >n3977712+795
n3977713:
	djn.f $n3977711+0, {n3977715+0
n3977714:
	dat $784, $8
n3977715:
	spl #n3977704+785, *n3977715+9
n3977716:
	dat *11, #26
n3977717:
	spl *n3977714+264, >n3977707+169
	nop #n3977720+517, }n3977720+3
n3977719:
	mov.i *n3977719+511, <n3977719+12
n3977720:
	add.i #n3977721+0, $n3977721+0
n3977721:
	end


; *** this program: May  5 2004 11:56:34
; *** MicroGP v2.1r10.3 [beta] "Astoria": May  4 2004 15:50:58
