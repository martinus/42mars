;redcode-nano
;name Rubble (old)
;author Roy van Rijn
;assert 1


b0 equ -4
b1 equ 58
b2 equ 41
b3 equ 44
b4 equ 55


spl.b  #     b0, <     b1
mov.i  @     b2, {     -1
mov.i  >     b3, {     -1
mov.i  {     -1, <     b4
mov.i  #      1, $     1   ; finally imp them


end
