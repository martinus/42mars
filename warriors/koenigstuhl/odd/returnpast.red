;redcode
;name Return To The Past
;author Jakub Kozisek
;strategy Timescape-like replicator
;strategy replicating engine -> 8 proc. - spl/mov + spl/mov + mov/djn (3 copies)
;strategy attack engine -> its something like decoy/bombing thing
;strategy               -> it'll dec. 2 positions and bomb 3rd (3c decoy maker)
;assert 1

	;========================
	add.f	1,	1	;#
	mul.f	#1,	#1	;##
	add.ab	-1,	-1	;###
	mov.f	@-1,	1	;####  mov.i {-1, {1 => mov.i {-4, {1
	mul.ab	#0,	#0	;###
	add.f	-1,	1	;##
	mul.a	#0,	1	;#
	;========================
	nop	<-1,	>1	;#
	add.f	#1,	1	;##
	add.f	#1,	1	;###
	add.ab	#1,	#1	;####
	mul.x	-1,	-1	;#####  UFF! This baby is for "unpacking"
	add.f	@-1,	1	;#####  our shitty bomb/decoy things
	mul.a	#1,	#-1	;#####           (read "movs")
	mul.a	-1,	-1	;####
	add.f	@-1,	@1	;###
	mul.x	1,	>1	;##
	mul.x	#1,	0	;#
	;========================
	add.f	1,	@1	;#
	add.f	1,	1	;##
	mul.f	#1,	#1	;###
	mul.ba	-1,	-1	;#### djn.f 1, <-1 => djn.f 4370, <-1 (STEP3)
	add.f 	@-1,	1	;###
	mul.ba	#1,	#1	;##
	add.a	-1,	@-1	;#
	;========================
	nop	<-1,	>1	;#
	spl	1,	>1	;##	generate some process and
	spl	1,	<-1	;##	modify our step generators
	spl	1,	>1	;#
	;========================
	nop	}1,	}1	;#      spl @0, {1 => spl @0, {-10305
	mul.ab	#-1,	1	;#		  (STEP2)
	;========================
	nop	}1,	}1	;#	spl @0, <1 => spl @0, <19441
	mul.ab	#1,	1	;#		  (STEP1)
	;########################
cp1	spl	@0,	{1	;#  first copy
	mov.i	}-1,	>-1	;#
	;========================
cp2	spl	@0,	<-1	;#  second one
	mov.i	}-1,	>-1	;#
	;========================
	mov.i	<1,	{-1	;#  those shitty decoy/bomb thing
	mov.i	{-1,	<1	;#  	       =II=
	;========================
cp3	mov.i	{-1,	{1	;#  last copy
	djn.f	1,	<-1	;#
	;========================

