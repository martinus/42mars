;redcode-DS
;name Ultradian
;author inversed
;strategy Moore-style paper
;kill Camper n00b
;assert 1

;;paper

pStep0 equ 7705
pStep1 equ 4206
bStep equ 2281

;;misc

org x0

;;

x0 spl 1, 0
mov -1, 0
spl 1, 0
mov x0 - 1, } silk0

silk0 spl @-6, > pStep0
mov } silk0, > silk0
mov } silk0, > silk0
paper spl pStep1, { from
mov } from, } paper
mov pbomb, > bStep
from mov paper + 6, } paper
jmz.f paper, * from
pbomb dat < 2667, < 5334


