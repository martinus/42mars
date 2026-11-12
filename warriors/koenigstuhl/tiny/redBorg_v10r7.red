; -*-asm-*-
; This program was automagically created by uGP (MicroGP v2.1r10.4 [beta])
; Copyright (c) 2002-2004 by Giovanni Squillero <giovanni.squillero@polito.it>
; 

;redcode-tiny
;name RedBorg v1.0r7
;author The MicroGP Corewars Collective
;url http://www.cad.polito.it/research/microgp.html
;strategy - Biological and technological distinctiveness
;strategy - of existing warriors was added to our own.
;strategy - Existing strategies were adapted to serve us.
;strategy - Resistance is futile.
;strategy - We are the RedBorg.
;strategy -
;strategy - The MicroGP Corewars Collective:
;strategy -      Bio
;strategy -      (ES)^2
;strategy -      Dr.Gapp
;strategy -      Ipso
;strategy -      MadMax
;strategy -      MasKrP
;strategy -      PPU
;assert CORESIZE == 800

	org n3366798
n3366796:
	sub.i $n3366800+0, $n3366798+0
	mov.i $n3366806+0, @n3366798+0
n3366798:
	sne.a }n3366798+54, }n3366799+36
n3366799:
	djn.f $n3366796+0, {n3366799+730
n3366800:
	spl #n3366800+774, <n3366800+774
n3366801:
	mov.i @n3366803+0, >n3366798+0
	mov.i @n3366803+0, >n3366798+0
n3366803:
	djn.f $n3366801+0, {n3366805+0
	dat $729, $8
n3366805:
	spl #n3366808+636, *n3366808+9
n3366806:
	dat }11, *26
	dat #414, <687
n3366808:
	spl #n3366808+774, <n3366808+774
n3366809:
	add.i #n3366809+1, >n3366809+1
	end


; *** this program: Jul  8 2004 18:32:28
; *** MicroGP v2.1r10.4 [beta] "Astoria": May  6 2004 12:21:57
