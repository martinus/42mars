;redcode
;name MiniVamp v1
;author B. Cook
; <bpc25@cam.ac.uk>
;strategy Vampire -> clear
;assert 1

org star

cnst equ 3315

ptr dat cnst, -cnst
bmb djn.b clear-5, >5
star add.f ptr, bmb
 mov.i bmb, @bmb
 djn.f star, ptr-2
clear mov.i ptr, <ptr-3
 mov.i ptr, <ptr-3
jump djn.b clear, <ptr-2

 end

