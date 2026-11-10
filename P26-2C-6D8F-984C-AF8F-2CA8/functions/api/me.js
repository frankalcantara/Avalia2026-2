import { json } from "../_util.js";

export const onRequestGet = ({ data }) => json({ user: data.user });
