;redcode-94
;name Fianchetto1
;author Jakub Kozisek
;strategy guess who is the reall author! :) ... sorry ... :-/
;assert 1

     split equ 70
     jamz  equ 524

start10	jmp   start1,   {-30
start11 jmp   start1,   {-22
start12 jmp   start1,   {-15
start13 jmp   start1,   {-31
start14 jmp   start1,   {-158
start15 jmp   start1,   {-84
start16 jmp   start1,   {-75
start17 jmp   start1,   {-90
start18 jmp   start1,   {-110
start19 jmp   start1,   {-130
     
start1  spl   2,        {-100
start2  spl   1,        {-150
start3  spl   1,        {-200
start4  spl   split,    0
start5  mov   >start4,  }start4
start6  mov   nostart,  }start4
start7  mov   nostart,  {start9
start8  mov   <start4,  {start9
start9  jmz   jamz,     *0
nostart dat   >1,       >1

end start1
