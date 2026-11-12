;redcode
;name Sprite
;author Sascha Zapf
;assert 1

away	equ	42

	spl    1,    <-80
	spl    1,    <-100

head  spl    @head, <away
      mov.i  }head, >head
bomb  mov.i  #1,     <1
cc    djn.b    -2,   <-5

